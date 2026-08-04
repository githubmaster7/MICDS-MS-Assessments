import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, type TxClient } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role, GradeLevel, Gender } from '@prisma/client'
import { z } from 'zod'
import { apiLimiter, checkRateLimit, userRateLimitKey, ipRateLimitKey } from '@/lib/rate-limit'
import { seedActivityRubric } from '@/lib/skills/seed-rubric'

const CreateActivityTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  gender: z.enum(['MALE', 'FEMALE'] as const).optional(),
  gradeLevel: z.enum(['GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8'] as const).optional(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const rl = await checkRateLimit(apiLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  const { searchParams } = req.nextUrl
  const isActive = searchParams.get('isActive')

  const where: Record<string, unknown> = {}
  if (isActive !== null) where.isActive = isActive === 'true'

  const activityTemplates = await db.activityTemplate.findMany({
    where,
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { teacherClassAssignments: { where: { isActive: true } } },
      },
    },
  })

  return NextResponse.json({ data: activityTemplates })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = CreateActivityTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    )
  }

  const { name, description, gender, gradeLevel } = parsed.data

  const existing = await db.activityTemplate.findUnique({
    where: {
      name_gender_gradeLevel: {
        name,
        gender: (gender ?? null) as Gender,
        gradeLevel: (gradeLevel ?? null) as GradeLevel,
      },
    },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A class with this name, gender, and grade level already exists.' },
      { status: 409 },
    )
  }

  const ip = ipRateLimitKey(req)

  // Creating the class and (when its name matches the base question bank —
  // e.g. a second "Flag Football" for a different grade/gender) populating
  // its Standard 1-4 grading content happen in one transaction, so a class
  // never ends up half-created if the rubric step fails partway through.
  const { activityTemplate, rubricApplied } = await db.$transaction(async (tx: TxClient) => {
    const created = await tx.activityTemplate.create({
      data: {
        name,
        description,
        gender: gender as Gender | undefined,
        gradeLevel: gradeLevel as GradeLevel | undefined,
      },
    })
    const rubric = await seedActivityRubric(tx, created.id, name)
    return { activityTemplate: created, rubricApplied: rubric.applied }
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.ACTIVITY_TEMPLATE_CREATED,
    targetType: 'ActivityTemplate',
    targetId: activityTemplate.id,
    targetLabel: name,
    afterValue: { name, description, gender, gradeLevel, rubricApplied },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: activityTemplate, rubricApplied }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role, GradeLevel, Gender } from '@prisma/client'
import { z } from 'zod'
import { PAGINATION_DEFAULTS } from '@/lib/constants'
import { ipRateLimitKey } from '@/lib/rate-limit'

const CreateGroupSchema = z.object({
  schoolYearId: z.string().uuid(),
  name: z.string().min(1).max(100),
  gradeLevel: z.enum(['GRADE_6', 'GRADE_7', 'GRADE_8'] as const),
  gender: z.enum(['MALE', 'FEMALE'] as const),
  description: z.string().max(500).optional(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    parseInt(searchParams.get('pageSize') ?? String(PAGINATION_DEFAULTS.PAGE_SIZE), 10),
  )
  const schoolYearId = searchParams.get('schoolYearId')
  const gradeLevel = searchParams.get('gradeLevel') as GradeLevel | null
  const gender = searchParams.get('gender') as Gender | null
  const isActive = searchParams.get('isActive')

  const where: Record<string, unknown> = {}
  if (schoolYearId) where.schoolYearId = schoolYearId
  if (gradeLevel && Object.values(GradeLevel).includes(gradeLevel)) where.gradeLevel = gradeLevel
  if (gender && Object.values(Gender).includes(gender)) where.gender = gender
  if (isActive !== null) where.isActive = isActive === 'true'

  const [total, groups] = await Promise.all([
    db.studentGroup.count({ where }),
    db.studentGroup.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
      include: {
        schoolYear: { select: { id: true, name: true } },
        _count: { select: { memberships: true } },
        groupRotationAssignments: {
          where: { status: 'ACTIVE' },
          take: 1,
          include: {
            carouselPosition: {
              include: {
                teacherClassAssignment: {
                  include: {
                    activityTemplate: { select: { name: true } },
                    teacherProfile: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    data: groups,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = CreateGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    )
  }

  const { schoolYearId, name, gradeLevel, gender, description } = parsed.data

  const schoolYear = await db.schoolYear.findUnique({
    where: { id: schoolYearId },
    select: { id: true },
  })
  if (!schoolYear) {
    return NextResponse.json({ error: 'School year not found.' }, { status: 404 })
  }

  const existing = await db.studentGroup.findUnique({
    where: { schoolYearId_name: { schoolYearId, name } },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'A group with this name already exists in this school year.' },
      { status: 409 },
    )
  }

  const ip = ipRateLimitKey(req)

  const group = await db.studentGroup.create({
    data: {
      schoolYearId,
      name,
      gradeLevel: gradeLevel as GradeLevel,
      gender: gender as Gender,
      description,
    },
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.STUDENT_GROUP_CREATED,
    targetType: 'StudentGroup',
    targetId: group.id,
    targetLabel: name,
    afterValue: { schoolYearId, name, gradeLevel, gender },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: group }, { status: 201 })
}

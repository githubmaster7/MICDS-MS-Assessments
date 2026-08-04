import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { apiLimiter, checkRateLimit, userRateLimitKey, ipRateLimitKey } from '@/lib/rate-limit'

const CreateAssignmentSchema = z.object({
  teacherProfileId: z.string().uuid(),
  activityTemplateId: z.string().uuid(),
  schoolYearId: z.string().uuid(),
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
  const teacherProfileId = searchParams.get('teacherProfileId')
  const schoolYearId = searchParams.get('schoolYearId')
  const isActive = searchParams.get('isActive')

  const where: Record<string, unknown> = {}
  if (teacherProfileId) where.teacherProfileId = teacherProfileId
  if (schoolYearId) where.schoolYearId = schoolYearId
  if (isActive !== null) where.isActive = isActive === 'true'

  const assignments = await db.teacherClassAssignment.findMany({
    where,
    orderBy: [{ teacherProfile: { lastName: 'asc' } }, { activityTemplate: { name: 'asc' } }],
    include: {
      teacherProfile: { select: { id: true, firstName: true, lastName: true } },
      activityTemplate: { select: { id: true, name: true, gender: true, gradeLevel: true } },
      schoolYear: { select: { id: true, name: true } },
      _count: { select: { carouselPositions: true } },
    },
  })

  return NextResponse.json({ data: assignments })
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

  const parsed = CreateAssignmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    )
  }

  const { teacherProfileId, activityTemplateId, schoolYearId } = parsed.data

  const [teacher, activityTemplate, schoolYear] = await Promise.all([
    db.teacherProfile.findUnique({ where: { id: teacherProfileId }, select: { id: true, firstName: true, lastName: true } }),
    db.activityTemplate.findUnique({ where: { id: activityTemplateId }, select: { id: true, name: true } }),
    db.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true } }),
  ])
  if (!teacher) return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 })
  if (!activityTemplate) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })
  if (!schoolYear) return NextResponse.json({ error: 'School year not found.' }, { status: 404 })

  const existing = await db.teacherClassAssignment.findUnique({
    where: {
      teacherProfileId_activityTemplateId_schoolYearId: { teacherProfileId, activityTemplateId, schoolYearId },
    },
  })
  if (existing) {
    if (existing.isActive) {
      return NextResponse.json(
        { error: 'This teacher is already assigned to this class for this school year.' },
        { status: 409 },
      )
    }
    // Reactivate a previously-removed assignment instead of erroring.
    const reactivated = await db.teacherClassAssignment.update({
      where: { id: existing.id },
      data: { isActive: true },
    })
    await createAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: AuditAction.TEACHER_CLASS_ASSIGNMENT_UPDATED,
      targetType: 'TeacherClassAssignment',
      targetId: reactivated.id,
      targetLabel: `${teacher.firstName} ${teacher.lastName} · ${activityTemplate.name}`,
      beforeValue: { isActive: false },
      afterValue: { isActive: true },
      ipAddress: ipRateLimitKey(req),
      userAgent: req.headers.get('user-agent') ?? undefined,
    })
    return NextResponse.json({ data: reactivated }, { status: 200 })
  }

  const ip = ipRateLimitKey(req)

  const assignment = await db.teacherClassAssignment.create({
    data: { teacherProfileId, activityTemplateId, schoolYearId },
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.TEACHER_CLASS_ASSIGNMENT_CREATED,
    targetType: 'TeacherClassAssignment',
    targetId: assignment.id,
    targetLabel: `${teacher.firstName} ${teacher.lastName} · ${activityTemplate.name}`,
    afterValue: { teacherProfileId, activityTemplateId, schoolYearId },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: assignment }, { status: 201 })
}

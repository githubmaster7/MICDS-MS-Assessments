import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, type TxClient } from '@/lib/db'
import { auditRegradeGrant } from '@/lib/audit'
import { Role, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey, rotationLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

const CreateGrantSchema = z.object({
  historicalClassInstanceId: z.string().uuid(),
  teacherRegradeEnabled: z.boolean(),
  applyToAllCurrentStudents: z.boolean(),
  studentProfileIds: z.array(z.string().uuid()).optional(),
  reason: z.string().min(1, 'A reason is required to reopen a locked instance.').max(500),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const rl = await checkRateLimit(rotationLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = CreateGrantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { historicalClassInstanceId, teacherRegradeEnabled, applyToAllCurrentStudents, studentProfileIds, reason } =
    parsed.data

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: historicalClassInstanceId },
    select: { id: true, status: true, studentGroupId: true },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })
  if (instance.status !== RotationStatus.LOCKED) {
    return NextResponse.json({ error: 'Only a locked class instance can be reopened.' }, { status: 409 })
  }

  const currentMembers = await db.studentGroupMembership.findMany({
    where: { studentGroupId: instance.studentGroupId, leftAt: null },
    select: { studentProfileId: true },
  })
  const currentMemberIds = new Set(currentMembers.map((m) => m.studentProfileId))

  let resolvedStudentIds: string[]
  if (applyToAllCurrentStudents) {
    resolvedStudentIds = [...currentMemberIds]
  } else {
    const requested = studentProfileIds ?? []
    const invalid = requested.filter((id) => !currentMemberIds.has(id))
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: 'One or more selected students are not current members of this group.' },
        { status: 400 },
      )
    }
    resolvedStudentIds = requested
  }

  if (!teacherRegradeEnabled && resolvedStudentIds.length === 0) {
    return NextResponse.json(
      { error: 'This grant would have no effect — enable teacher regrading or select at least one student.' },
      { status: 400 },
    )
  }

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  const grant = await db.$transaction(async (tx: TxClient) => {
    const created = await tx.classRegradeGrant.create({
      data: {
        historicalClassInstanceId,
        teacherRegradeEnabled,
        reason,
        openedBy: session.user.id,
      },
    })

    if (resolvedStudentIds.length > 0) {
      await tx.classRegradeGrantStudent.createMany({
        data: resolvedStudentIds.map((studentProfileId) => ({ grantId: created.id, studentProfileId })),
      })
    }

    return created
  })

  await auditRegradeGrant({
    actorId: session.user.id,
    actorRole: session.user.role,
    grantId: grant.id,
    historicalClassInstanceId,
    action: 'OPENED',
    reason,
    teacherRegradeEnabled,
    studentCount: resolvedStudentIds.length,
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ data: { id: grant.id, teacherRegradeEnabled, studentCount: resolvedStudentIds.length } })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const statusFilter = searchParams.get('status')
  const studentGroupId = searchParams.get('studentGroupId')

  const grants = await db.classRegradeGrant.findMany({
    where: {
      ...(statusFilter === 'open' ? { closedAt: null } : {}),
      ...(studentGroupId ? { historicalClassInstance: { studentGroupId } } : {}),
    },
    orderBy: { openedAt: 'desc' },
    include: {
      historicalClassInstance: {
        select: {
          id: true,
          status: true,
          studentGroup: { select: { id: true, name: true } },
          groupRotationAssignment: { select: { rotationNumber: true } },
          teacherClassAssignment: {
            select: {
              activityTemplate: { select: { name: true } },
              teacherProfile: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
      opener: { select: { email: true } },
      closer: { select: { email: true } },
      studentGrants: {
        select: { studentProfile: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  })

  return NextResponse.json({ data: grants })
}

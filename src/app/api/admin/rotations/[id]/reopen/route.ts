import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditClassInstance, AuditAction } from '@/lib/audit'
import { Role, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

const ReopenSchema = z.object({
  reason: z.string().min(1, 'A reason is required to reopen a locked instance.').max(500),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = ReopenSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { reason } = parsed.data

  const instance = await db.historicalClassInstance.findUnique({
    where: { id },
    select: { id: true, status: true, lockedAt: true },
  })

  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })

  if (instance.status !== RotationStatus.LOCKED) {
    return NextResponse.json({ error: 'This class instance is not locked.' }, { status: 409 })
  }

  const ip = ipRateLimitKey(req)

  await db.historicalClassInstance.update({
    where: { id },
    data: {
      status: RotationStatus.ACTIVE,
      reopenedAt: new Date(),
      reopenedBy: session.user.id,
      reopenReason: reason,
    },
  })

  await auditClassInstance({
    actorId: session.user.id,
    actorRole: session.user.role,
    historicalClassInstanceId: id,
    action: AuditAction.CLASS_INSTANCE_REOPENED,
    reason,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ message: 'Class instance reopened for grading.' })
}

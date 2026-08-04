import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'

/**
 * Real per-group rotation history — one row per group per rotation event,
 * showing exactly what changed (from which activity to which) and whether
 * it was later reverted.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const planId = req.nextUrl.searchParams.get('planId')
  if (!planId) {
    return NextResponse.json({ error: 'planId query parameter is required.' }, { status: 400 })
  }

  const rows = await db.rotationHistory.findMany({
    where: { carouselPlanId: planId },
    orderBy: { executedAt: 'desc' },
    take: 200,
    include: {
      studentGroup: { select: { id: true, name: true } },
      executor: { select: { email: true } },
      reverser: { select: { email: true } },
    },
  })

  const data = rows.map((r) => ({
    id: r.id,
    studentGroupId: r.studentGroup.id,
    groupName: r.studentGroup.name,
    rotationNumber: r.rotationNumber,
    fromActivityName: r.fromActivityName,
    toActivityName: r.toActivityName,
    executedAt: r.executedAt,
    executedByEmail: r.executor.email,
    notes: r.notes,
    isReverted: r.reversedAt !== null,
    revertedAt: r.reversedAt,
    revertedByEmail: r.reverser?.email ?? null,
    revertReason: r.reversalReason,
  }))

  return NextResponse.json({ data })
}

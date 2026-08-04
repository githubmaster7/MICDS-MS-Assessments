import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'
import { apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

/**
 * Read-only school year listing for admin dropdowns (e.g. creating a
 * student group). Full school year/term CRUD is a separate, larger feature.
 */
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

  const schoolYears = await db.schoolYear.findMany({
    orderBy: { startDate: 'desc' },
    select: { id: true, name: true, startDate: true, endDate: true, isActive: true },
  })

  return NextResponse.json({ data: schoolYears })
}

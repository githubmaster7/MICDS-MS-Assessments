import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { publicStudentSearchLimiter, checkRateLimit, ipRateLimitKey } from '@/lib/rate-limit'

const MAX_RESULTS = 8
const MIN_QUERY_LENGTH = 2

/**
 * Unauthenticated, rate-limited lookup used by the parent signup form's
 * child picker. Only enough to let a parent recognize their own child —
 * no email, grades, or other sensitive fields — and requires a real search
 * term (no browsable roster) to deter scraping.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = await checkRateLimit(publicStudentSearchLimiter, ipRateLimitKey(req))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  const search = req.nextUrl.searchParams.get('search')?.trim()
  if (!search || search.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ data: [] })
  }

  const students = await db.studentProfile.findMany({
    where: {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
      ],
    },
    take: MAX_RESULTS,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: { id: true, firstName: true, lastName: true, gradeLevel: true, studentId: true },
  })

  return NextResponse.json({ data: students })
}

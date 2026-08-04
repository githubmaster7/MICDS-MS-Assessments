import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'
import { apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

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

  const search = req.nextUrl.searchParams.get('search')?.trim()

  const parents = await db.parentProfile.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { user: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      user: { select: { email: true } },
      studentLinks: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          createdAt: true,
          studentProfile: {
            select: { id: true, firstName: true, lastName: true, studentId: true, gradeLevel: true },
          },
        },
      },
    },
  })

  return NextResponse.json({
    data: parents.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      email: p.user.email,
      links: p.studentLinks.map((l) => ({
        id: l.id,
        createdAt: l.createdAt,
        student: l.studentProfile,
      })),
    })),
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, AccountStatus } from '@prisma/client'
import { PAGINATION_DEFAULTS } from '@/lib/constants'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const statusFilter = searchParams.get('status') as AccountStatus | null
  const search = searchParams.get('search')?.trim()
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    parseInt(searchParams.get('pageSize') ?? String(PAGINATION_DEFAULTS.PAGE_SIZE), 10),
  )

  const where: { status?: AccountStatus; user?: { email: { contains: string; mode: 'insensitive' } } } = {}
  if (
    statusFilter &&
    Object.values(AccountStatus).includes(statusFilter)
  ) {
    where.status = statusFilter
  } else {
    // Default to pending approval
    where.status = AccountStatus.PENDING_ADMIN_APPROVAL
  }
  if (search) {
    where.user = { email: { contains: search, mode: 'insensitive' } }
  }

  const [total, requests] = await Promise.all([
    db.signupRequest.count({ where }),
    db.signupRequest.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            emailVerifiedAt: true,
            createdAt: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
  ])

  const data = requests.map((r) => ({
    id: r.id,
    email: r.user.email,
    requestedRole: r.requestedRole,
    status: r.status,
    createdAt: r.createdAt,
    adminNote: r.adminNote,
    reviewedAt: r.reviewedAt,
    reviewer: r.reviewer ? { email: r.reviewer.email } : null,
  }))

  return NextResponse.json({
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, AuditAction, Prisma } from '@prisma/client'
import { PAGINATION_DEFAULTS } from '@/lib/constants'
import { apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

function toCsvField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  // Exports are more expensive than a paginated page load, so both share
  // the same general API limiter.
  const rl = await checkRateLimit(apiLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  const { searchParams } = req.nextUrl
  const format = searchParams.get('format')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = format === 'csv'
    ? Math.min(10000, parseInt(searchParams.get('limit') ?? '1000', 10))
    : Math.min(
        PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
        parseInt(searchParams.get('pageSize') ?? String(PAGINATION_DEFAULTS.PAGE_SIZE), 10),
      )

  const actorId = searchParams.get('actorId')
  const actorSearch = searchParams.get('actor')?.trim()
  const actionFilter = searchParams.get('action') as AuditAction | null
  const targetType = searchParams.get('targetType')
  const targetId = searchParams.get('targetId')
  const fromDate = searchParams.get('from')
  const toDate = searchParams.get('to')

  const where: Prisma.AuditLogWhereInput = {}
  if (actorId) where.actorId = actorId
  if (actorSearch) {
    where.actor = { email: { contains: actorSearch, mode: 'insensitive' } }
  }
  if (actionFilter && Object.values(AuditAction).includes(actionFilter)) {
    where.action = actionFilter
  }
  if (targetType) where.targetType = targetType
  if (targetId) where.targetId = targetId

  if (fromDate || toDate) {
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (fromDate) {
      const d = new Date(fromDate)
      if (!isNaN(d.getTime())) dateFilter.gte = d
    }
    if (toDate) {
      const d = new Date(toDate)
      if (!isNaN(d.getTime())) dateFilter.lte = d
    }
    if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter
  }

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      skip: format === 'csv' ? 0 : (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { id: true, email: true, role: true },
        },
      },
    }),
  ])

  if (format === 'csv') {
    const header = ['Timestamp', 'Actor', 'Action', 'Target Type', 'Target', 'Reason', 'IP Address'].join(',')
    const rows = logs.map((log) =>
      [
        log.createdAt.toISOString(),
        log.actor?.email ?? 'System',
        log.action,
        log.targetType,
        log.targetLabel ?? log.targetId ?? '',
        log.reason ?? '',
        log.ipAddress ?? '',
      ]
        .map(toCsvField)
        .join(','),
    )
    const csv = [header, ...rows].join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  }

  return NextResponse.json({
    data: logs,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}

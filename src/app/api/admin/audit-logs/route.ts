import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, AuditAction } from '@prisma/client'
import { PAGINATION_DEFAULTS } from '@/lib/constants'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    parseInt(searchParams.get('pageSize') ?? String(PAGINATION_DEFAULTS.PAGE_SIZE), 10),
  )

  const actorId = searchParams.get('actorId')
  const actionFilter = searchParams.get('action') as AuditAction | null
  const targetType = searchParams.get('targetType')
  const targetId = searchParams.get('targetId')
  const fromDate = searchParams.get('from')
  const toDate = searchParams.get('to')

  const where: Record<string, unknown> = {}
  if (actorId) where.actorId = actorId
  if (actionFilter && Object.values(AuditAction).includes(actionFilter)) {
    where.action = actionFilter
  }
  if (targetType) where.targetType = targetType
  if (targetId) where.targetId = targetId

  if (fromDate || toDate) {
    const dateFilter: Record<string, Date> = {}
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
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { id: true, email: true, role: true },
        },
      },
    }),
  ])

  return NextResponse.json({
    data: logs,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}

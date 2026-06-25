import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role, AccountStatus } from '@prisma/client'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { PAGINATION_DEFAULTS, ALLOWED_EMAIL_DOMAIN } from '@/lib/constants'
import { ipRateLimitKey } from '@/lib/rate-limit'

const CreateUserSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(8).max(128),
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] as const),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    parseInt(searchParams.get('pageSize') ?? String(PAGINATION_DEFAULTS.PAGE_SIZE), 10),
  )
  const roleFilter = searchParams.get('role') as Role | null
  const statusFilter = searchParams.get('status') as AccountStatus | null
  const search = searchParams.get('search')?.trim()

  const where: Record<string, unknown> = {}
  if (roleFilter && (Object.values(Role) as string[]).includes(roleFilter)) {
    where.role = roleFilter
  }
  if (statusFilter && (Object.values(AccountStatus) as string[]).includes(statusFilter)) {
    where.status = statusFilter
  }
  if (search) {
    where.email = { contains: search, mode: 'insensitive' }
  }

  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        studentProfile: { select: { id: true, firstName: true, lastName: true } },
        teacherProfile: { select: { id: true, firstName: true, lastName: true } },
        parentProfile: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ])

  return NextResponse.json({
    data: users,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    )
  }

  const { email, password, role } = parsed.data

  const domain = email.split('@')[1]
  if (domain !== ALLOWED_EMAIL_DOMAIN) {
    return NextResponse.json(
      { error: 'Only @micds.org email addresses are permitted.' },
      { status: 400 },
    )
  }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await db.user.create({
    data: {
      email,
      passwordHash,
      role: role as Role,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  })

  const ip = ipRateLimitKey(req)
  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.USER_REGISTERED,
    targetType: 'User',
    targetId: user.id,
    targetLabel: email,
    afterValue: { role, status: AccountStatus.ACTIVE, createdByAdmin: true },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: user }, { status: 201 })
}

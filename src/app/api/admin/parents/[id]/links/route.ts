import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditParentLink } from '@/lib/audit'
import { Role, Prisma } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

const CreateLinkSchema = z.object({
  studentProfileId: z.string().uuid(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id: parentProfileId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = CreateLinkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    )
  }
  const { studentProfileId } = parsed.data

  const parent = await db.parentProfile.findUnique({ where: { id: parentProfileId }, select: { id: true } })
  if (!parent) return NextResponse.json({ error: 'Parent not found.' }, { status: 404 })

  const student = await db.studentProfile.findUnique({ where: { id: studentProfileId }, select: { id: true } })
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })

  let link
  try {
    link = await db.parentStudentLink.create({
      data: { parentProfileId, studentProfileId, createdBy: session.user.id },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'This student is already linked to this parent.' }, { status: 409 })
    }
    throw err
  }

  await auditParentLink({
    actorId: session.user.id,
    actorRole: session.user.role,
    linkId: link.id,
    parentProfileId,
    studentProfileId,
    action: 'CREATED',
    ipAddress: ipRateLimitKey(req),
  })

  return NextResponse.json({ data: link }, { status: 201 })
}

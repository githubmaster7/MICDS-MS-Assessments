import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditParentLink } from '@/lib/audit'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string; linkId: string }>
}

const RouteParamIdsSchema = z.object({
  id: z.string().uuid(),
  linkId: z.string().uuid(),
})

export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id: parentProfileId, linkId } = await params

  if (!RouteParamIdsSchema.safeParse({ id: parentProfileId, linkId }).success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const link = await db.parentStudentLink.findUnique({ where: { id: linkId } })
  if (!link || link.parentProfileId !== parentProfileId) {
    return NextResponse.json({ error: 'Link not found.' }, { status: 404 })
  }

  await db.parentStudentLink.delete({ where: { id: linkId } })

  await auditParentLink({
    actorId: session.user.id,
    actorRole: session.user.role,
    linkId: link.id,
    parentProfileId: link.parentProfileId,
    studentProfileId: link.studentProfileId,
    action: 'REMOVED',
    ipAddress: ipRateLimitKey(req),
  })

  return NextResponse.json({ data: { success: true } })
}

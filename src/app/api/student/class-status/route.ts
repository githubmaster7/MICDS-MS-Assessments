import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { hasOpenStudentRegradeGrant } from '@/lib/authorization'
import { Role, RotationStatus } from '@prisma/client'

/**
 * Lightweight status check meant to be polled from an open submission form,
 * so a student sees access revoked (or restored) live, without needing to
 * reload the page, whenever an admin locks/reopens a class.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.STUDENT) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const instanceId = req.nextUrl.searchParams.get('instanceId')
  if (!instanceId) return NextResponse.json({ error: 'instanceId is required.' }, { status: 400 })

  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!studentProfile) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: { status: true },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })

  const isOpen =
    instance.status === RotationStatus.ACTIVE ||
    (await hasOpenStudentRegradeGrant(studentProfile.id, instanceId))

  return NextResponse.json({ data: { isOpen } })
}

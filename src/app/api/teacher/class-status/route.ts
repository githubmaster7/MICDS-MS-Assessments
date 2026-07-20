import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canTeacherGrade } from '@/lib/authorization'
import { Role } from '@prisma/client'

/**
 * Lightweight status check meant to be polled from an open grading page, so
 * a teacher sees Save get disabled (or re-enabled) live, without needing to
 * reload the page, whenever an admin locks/reopens a class.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const instanceId = req.nextUrl.searchParams.get('instanceId')
  if (!instanceId) return NextResponse.json({ error: 'instanceId is required.' }, { status: 400 })

  const canEdit = await canTeacherGrade(session.user.id, instanceId)

  return NextResponse.json({ data: { canEdit } })
}

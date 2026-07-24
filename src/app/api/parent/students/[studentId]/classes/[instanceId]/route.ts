import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireParentStudentLink } from '@/lib/authorization'
import { getParentClassDetail } from '@/lib/parent/class-detail'
import { Role } from '@prisma/client'

interface RouteParams {
  params: Promise<{ studentId: string; instanceId: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.PARENT) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { studentId, instanceId } = await params

  try {
    await requireParentStudentLink(session.user.id, studentId)
  } catch {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const data = await getParentClassDetail(studentId, instanceId)
  if (!data) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

  return NextResponse.json({ data })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'
import { getClassInstanceAnalytics } from '@/lib/analytics/class-instance-analytics'

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

// Read-only group analytics for a single class instance: per-standard score
// distributions pooled across every student (byStudent breakdown), a
// class-wide Approach to Learning summary, and a per-student roster row
// (letter grade, per-standard scores, ATL ratings, submission/grading
// attempt counts for the two history buttons). Viewable even on a LOCKED
// instance — this is read-only, unlike the grading PUT routes.
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { instanceId } = await params

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 })

  const analytics = await getClassInstanceAnalytics(instanceId)
  if (!analytics) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })
  if (analytics.teacherProfileId !== teacherProfile.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  return NextResponse.json({ data: analytics })
}

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'
import { getGradeAndSubmissionHistory } from '@/lib/grading/history'

interface RouteParams {
  params: Promise<{ studentId: string; instanceId: string }>
}

/**
 * Admin-scoped read-only counterpart to the teacher's own grade-history
 * route — same shared getGradeAndSubmissionHistory data, no ownership
 * restriction (an admin can view any student/instance), used to power the
 * same StudentHistoryModal on admin Group/Teacher/Class detail pages.
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { studentId, instanceId } = await params

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: { id: true },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })

  const { assessments, snapshot, gradeHistory, studentHistory, submissionStatus, attemptCount } =
    await getGradeAndSubmissionHistory(studentId, instanceId)

  return NextResponse.json({
    data: { assessments, snapshot, gradeHistory, studentHistory, submissionStatus, attemptCount },
  })
}

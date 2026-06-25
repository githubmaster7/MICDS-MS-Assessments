import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { canViewStudent } from '@/lib/authorization'
import { Role } from '@prisma/client'

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const { instanceId } = await params

  // Optional studentId filter — if provided, return only that student's snapshot
  const studentId = req.nextUrl.searchParams.get('studentId')

  if (studentId) {
    // Authorization: verify the caller can view this student
    const allowed = await canViewStudent(session.user.id, session.user.role, studentId)
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const snapshots = await db.gradeCalculationSnapshot.findMany({
      where: {
        studentProfileId: studentId,
        historicalClassInstanceId: instanceId,
      },
      orderBy: { calculatedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        standard1Score: true,
        standard2Score: true,
        standard3Score: true,
        standard4Score: true,
        overallAverage: true,
        letterGrade: true,
        calculatedAt: true,
        snapshotData: true,
      },
    })

    return NextResponse.json({ data: snapshots })
  }

  // No studentId — return all students in the instance (admin or teacher only)
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.TEACHER) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  // For teachers, verify they are assigned to this instance
  if (session.user.role === Role.TEACHER) {
    const teacherProfile = await db.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    })
    if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 })

    const instance = await db.historicalClassInstance.findUnique({
      where: { id: instanceId },
      select: {
        teacherClassAssignment: { select: { teacherProfileId: true } },
      },
    })
    if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })
    if (instance.teacherClassAssignment.teacherProfileId !== teacherProfile.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
  }

  // Fetch all snapshots for the instance (latest per student)
  const allSnapshots = await db.gradeCalculationSnapshot.findMany({
    where: { historicalClassInstanceId: instanceId },
    orderBy: { calculatedAt: 'desc' },
    select: {
      id: true,
      studentProfileId: true,
      standard1Score: true,
      standard2Score: true,
      standard3Score: true,
      standard4Score: true,
      overallAverage: true,
      letterGrade: true,
      calculatedAt: true,
      studentProfile: {
        select: { id: true, firstName: true, lastName: true, studentId: true },
      },
    },
  })

  // De-dupe: latest per student
  const seenStudents = new Set<string>()
  const latestSnapshots = allSnapshots.filter((s) => {
    if (seenStudents.has(s.studentProfileId)) return false
    seenStudents.add(s.studentProfileId)
    return true
  })

  return NextResponse.json({ data: latestSnapshots })
}

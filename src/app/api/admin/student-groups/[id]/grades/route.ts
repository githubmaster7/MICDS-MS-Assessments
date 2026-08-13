import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const IdSchema = z.string().uuid()

/**
 * Every student in this group, and every graded class they've had within
 * it this year — the admin's "click into a group, see everyone's grades"
 * view. Pulls the latest GradeCalculationSnapshot per class instance (a
 * class can be recalculated after a teacher edits scores).
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id: studentGroupId } = await params

  if (!IdSchema.safeParse(studentGroupId).success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const group = await db.studentGroup.findUnique({ where: { id: studentGroupId }, select: { id: true, name: true } })
  if (!group) return NextResponse.json({ error: 'Student group not found.' }, { status: 404 })

  const members = await db.studentGroupMembership.findMany({
    where: { studentGroupId, leftAt: null },
    include: { studentProfile: { select: { id: true, firstName: true, lastName: true, studentId: true } } },
    orderBy: { studentProfile: { lastName: 'asc' } },
  })

  const snapshots = await db.gradeCalculationSnapshot.findMany({
    where: {
      studentProfileId: { in: members.map((m) => m.studentProfileId) },
      historicalClassInstance: { studentGroupId },
    },
    orderBy: { calculatedAt: 'desc' },
    select: {
      studentProfileId: true,
      historicalClassInstanceId: true,
      standard1Score: true,
      standard2Score: true,
      standard3Score: true,
      standard4Score: true,
      overallAverage: true,
      letterGrade: true,
      calculatedAt: true,
      historicalClassInstance: {
        select: {
          status: true,
          teacherClassAssignment: {
            select: {
              activityTemplate: { select: { name: true } },
              teacherProfile: { select: { firstName: true, lastName: true } },
            },
          },
          groupRotationAssignment: { select: { rotationNumber: true } },
        },
      },
    },
  })

  // Keep only the most recent snapshot per (student, class instance) pair —
  // grades can be recalculated after a teacher edits scores.
  const latestByKey = new Map<string, (typeof snapshots)[number]>()
  for (const s of snapshots) {
    const key = `${s.studentProfileId}:${s.historicalClassInstanceId}`
    if (!latestByKey.has(key)) latestByKey.set(key, s)
  }

  const gradesByStudent = new Map<string, Array<{
    rotationNumber: number
    activityName: string
    teacherName: string
    status: string
    letterGrade: string | null
    overallAverage: number | null
    standard1Score: number | null
    standard2Score: number | null
    standard3Score: number | null
    standard4Score: number | null
  }>>()
  for (const s of latestByKey.values()) {
    const list = gradesByStudent.get(s.studentProfileId) ?? []
    list.push({
      rotationNumber: s.historicalClassInstance.groupRotationAssignment.rotationNumber,
      activityName: s.historicalClassInstance.teacherClassAssignment.activityTemplate.name,
      teacherName: `${s.historicalClassInstance.teacherClassAssignment.teacherProfile.firstName} ${s.historicalClassInstance.teacherClassAssignment.teacherProfile.lastName}`,
      status: s.historicalClassInstance.status,
      letterGrade: s.letterGrade,
      overallAverage: s.overallAverage ? Number(s.overallAverage) : null,
      standard1Score: s.standard1Score ? Number(s.standard1Score) : null,
      standard2Score: s.standard2Score ? Number(s.standard2Score) : null,
      standard3Score: s.standard3Score ? Number(s.standard3Score) : null,
      standard4Score: s.standard4Score ? Number(s.standard4Score) : null,
    })
    gradesByStudent.set(s.studentProfileId, list)
  }

  const data = members.map((m) => ({
    studentProfileId: m.studentProfileId,
    firstName: m.studentProfile.firstName,
    lastName: m.studentProfile.lastName,
    studentId: m.studentProfile.studentId,
    classes: (gradesByStudent.get(m.studentProfileId) ?? []).sort((a, b) => a.rotationNumber - b.rotationNumber),
  }))

  return NextResponse.json({ data })
}

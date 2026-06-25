import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'
import { PAGINATION_DEFAULTS } from '@/lib/constants'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = Math.min(
    PAGINATION_DEFAULTS.MAX_PAGE_SIZE,
    parseInt(searchParams.get('pageSize') ?? String(PAGINATION_DEFAULTS.PAGE_SIZE), 10),
  )

  const [total, instances] = await Promise.all([
    db.historicalClassInstance.count({
      where: { teacherClassAssignment: { teacherProfileId: teacherProfile.id } },
    }),
    db.historicalClassInstance.findMany({
      where: { teacherClassAssignment: { teacherProfileId: teacherProfile.id } },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        studentGroup: { select: { id: true, name: true, gradeLevel: true, gender: true } },
        teacherClassAssignment: {
          include: {
            activityTemplate: { select: { id: true, name: true } },
          },
        },
        groupRotationAssignment: {
          select: { rotationNumber: true, startDate: true, endDate: true, status: true },
        },
        _count: {
          select: { teacherAssessments: true, studentSubmissions: true },
        },
      },
    }),
  ])

  return NextResponse.json({
    data: instances,
    pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}

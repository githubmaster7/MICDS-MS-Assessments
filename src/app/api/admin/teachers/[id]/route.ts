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
 * Single teacher's identity — id here is TeacherProfile.id, matching the
 * teacherProfileId already used by /api/admin/classes?teacherProfileId=
 * and by the teacher-class-assignments endpoints, so the admin Teacher
 * detail page can reuse those existing endpoints for its class list
 * instead of duplicating that query.
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const teacher = await db.teacherProfile.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeId: true,
      user: { select: { email: true, status: true } },
    },
  })
  if (!teacher) return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 })

  return NextResponse.json({ data: teacher })
}

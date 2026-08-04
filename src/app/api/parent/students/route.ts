import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.PARENT) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const parentProfile = await db.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!parentProfile) return NextResponse.json({ error: 'Parent profile not found.' }, { status: 404 })

  const links = await db.parentStudentLink.findMany({
    where: { parentProfileId: parentProfile.id },
    include: {
      studentProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gradeLevel: true,
          gender: true,
          studentId: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    data: links.map((l: { studentProfile: unknown }) => l.studentProfile),
  })
}

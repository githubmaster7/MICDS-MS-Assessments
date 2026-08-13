import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { getClassInstanceAnalytics } from '@/lib/analytics/class-instance-analytics'

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

const InstanceIdSchema = z.string().uuid()

/**
 * Admin-scoped read-only analytics for one class instance — same shared
 * getClassInstanceAnalytics data the teacher's own Class Analytics page
 * uses, so an admin viewing a Group, a Teacher, or a Class directly always
 * sees the exact same numbers a teacher would for that same instance.
 * Admins have no ownership restriction (unlike the teacher route).
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { instanceId } = await params

  if (!InstanceIdSchema.safeParse(instanceId).success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const analytics = await getClassInstanceAnalytics(instanceId)
  if (!analytics) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })

  return NextResponse.json({ data: analytics })
}

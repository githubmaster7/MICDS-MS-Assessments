import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Gender, GradeLevel, Role } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

const UpdateActivityTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  gender: z.enum(['MALE', 'FEMALE'] as const).nullable().optional(),
  gradeLevel: z.enum(['GRADE_5', 'GRADE_6', 'GRADE_7', 'GRADE_8'] as const).nullable().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

const IdSchema = z.string().uuid()

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = UpdateActivityTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const updateData = parsed.data
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  const existing = await db.activityTemplate.findUnique({
    where: { id },
    select: { id: true, name: true, description: true, isActive: true, gender: true, gradeLevel: true },
  })
  if (!existing) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

  const nextName = updateData.name ?? existing.name
  const nextGender = updateData.gender !== undefined ? updateData.gender : existing.gender
  const nextGradeLevel = updateData.gradeLevel !== undefined ? updateData.gradeLevel : existing.gradeLevel
  if (updateData.gender !== undefined || updateData.gradeLevel !== undefined || updateData.name !== undefined) {
    const collision = await db.activityTemplate.findUnique({
      where: {
        name_gender_gradeLevel: {
          name: nextName,
          gender: (nextGender ?? null) as Gender,
          gradeLevel: (nextGradeLevel ?? null) as GradeLevel,
        },
      },
      select: { id: true },
    })
    if (collision && collision.id !== id) {
      return NextResponse.json(
        { error: 'A class with this name, gender, and grade level already exists.' },
        { status: 409 },
      )
    }
  }

  const ip = ipRateLimitKey(req)

  const updated = await db.activityTemplate.update({
    where: { id },
    data: updateData,
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.ACTIVITY_TEMPLATE_UPDATED,
    targetType: 'ActivityTemplate',
    targetId: id,
    targetLabel: updated.name,
    beforeValue: { name: existing.name, description: existing.description, isActive: existing.isActive, gender: existing.gender, gradeLevel: existing.gradeLevel },
    afterValue: updateData,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: updated })
}

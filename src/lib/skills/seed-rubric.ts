import { Prisma, PrismaClient, SkillType } from '@prisma/client'
import { ACTIVITY_SKILLS } from './definitions'
import { STANDARD2_QUESTIONS } from './standard2-questions'
import { STANDARD3_QUESTIONS } from './standard3-questions'
import { STANDARD4_QUESTIONS } from './standard4-questions'

type DbClient = PrismaClient | Prisma.TransactionClient

const QUESTION_SETS_BY_STANDARD: Record<number, Record<string, { promptText: string; displayOrder: number }[]>> = {
  2: STANDARD2_QUESTIONS,
  3: STANDARD3_QUESTIONS,
  4: STANDARD4_QUESTIONS,
}

export interface SeedActivityRubricResult {
  /** False when activityName has no entry anywhere in the base question bank — nothing was created. */
  applied: boolean
  /** skillName -> SkillDefinition.id, for standard 1 */
  skillIdsByName: Record<string, string>
  /** `${standardNumber}-${displayOrder}` -> PromptDefinition.id, for standards 2-4 */
  promptIdsByStdOrder: Record<string, string>
}

/**
 * Single source of truth for populating one ActivityTemplate's grading
 * content (Standard 1 skills + Standard 2-4 concept questions) from the base
 * question bank in src/lib/skills/* — the same content transcribed from the
 * school's rubric spreadsheet. Used both by prisma/seed.ts (the nine-activity
 * carousel) and by the admin "Add class" API route, so a newly created class
 * matching a known activity name (e.g. a second "Flag Football" for a
 * different grade/gender) gets the exact same grading content automatically,
 * without anyone re-authoring it per class.
 *
 * Idempotent: safe to call even if some rubric content already exists for
 * this activityTemplateId (find-or-create per row), so re-running the seed
 * script or calling this twice never duplicates content.
 */
export async function seedActivityRubric(
  db: DbClient,
  activityTemplateId: string,
  activityName: string,
): Promise<SeedActivityRubricResult> {
  const skills = ACTIVITY_SKILLS[activityName]
  const hasAnyBaseContent = !!skills || [2, 3, 4].some((std) => QUESTION_SETS_BY_STANDARD[std][activityName])

  const skillIdsByName: Record<string, string> = {}
  const promptIdsByStdOrder: Record<string, string> = {}

  if (!hasAnyBaseContent) {
    return { applied: false, skillIdsByName, promptIdsByStdOrder }
  }

  // Standard 1 — fundamental + specific skills
  if (skills) {
    const foundRv1 = await db.rubricVersion.findFirst({
      where: { activityTemplateId, standardNumber: 1, version: 1 },
    })
    const rv1 = foundRv1 ?? await db.rubricVersion.create({
      data: { activityTemplateId, standardNumber: 1, activityName, version: 1, isActive: true },
    })

    // displayOrder is unique per rubricVersionId in the schema, so it's
    // renumbered sequentially across both categories here — skillType (not
    // displayOrder) is what the UI groups fundamental vs. specific by.
    const allSkills = [
      ...skills.fundamental.map((s) => ({ ...s, type: SkillType.FUNDAMENTAL })),
      ...skills.specific.map((s) => ({ ...s, type: SkillType.SPECIFIC })),
    ]
    for (let i = 0; i < allSkills.length; i++) {
      const skill = allSkills[i]
      const displayOrder = i + 1
      const found = await db.skillDefinition.findFirst({
        where: { rubricVersionId: rv1.id, skillName: skill.name },
      })
      const sd = found ?? await db.skillDefinition.create({
        data: { rubricVersionId: rv1.id, skillType: skill.type, skillName: skill.name, displayOrder, isActive: true },
      })
      skillIdsByName[skill.name] = sd.id
    }
  }

  // Standards 2-4 — concept-question prompts
  for (const stdNum of [2, 3, 4]) {
    const questions = QUESTION_SETS_BY_STANDARD[stdNum][activityName]
    if (!questions) continue

    const foundRvOther = await db.rubricVersion.findFirst({
      where: { activityTemplateId, standardNumber: stdNum, version: 1 },
    })
    const rvOther = foundRvOther ?? await db.rubricVersion.create({
      data: { activityTemplateId, standardNumber: stdNum, activityName, version: 1, isActive: true },
    })

    for (const q of questions) {
      const found = await db.promptDefinition.findFirst({
        where: { rubricVersionId: rvOther.id, standardNumber: stdNum, displayOrder: q.displayOrder },
      })
      const pd = found ?? await db.promptDefinition.create({
        data: {
          rubricVersionId: rvOther.id,
          standardNumber: stdNum,
          promptText: q.promptText,
          displayOrder: q.displayOrder,
          isActive: true,
        },
      })
      promptIdsByStdOrder[`${stdNum}-${q.displayOrder}`] = pd.id
    }
  }

  return { applied: true, skillIdsByName, promptIdsByStdOrder }
}

/**
 * Class-specific skill definitions for Standard 1 (Movement Skills).
 *
 * Each activity has two skill categories:
 *   fundamental – core movement competencies. Each fundamental skill is
 *                 introduced/assessed during ONE specific activity (per the
 *                 rubric spreadsheet), not repeated across every activity.
 *   specific    – sport/activity-specific skills, assessed only during that
 *                 activity's own unit.
 *
 * Athletic Development only has fundamentals (no specific-skill assessment).
 * Wrestling and Yoga only have specific skills (no fundamental-movement
 * assessment items of their own in the source rubric).
 *
 * displayOrder is 1-based within each category.
 */

export interface SkillDefinitionEntry {
  name: string
  displayOrder: number
}

export interface ActivitySkills {
  fundamental: SkillDefinitionEntry[]
  specific: SkillDefinitionEntry[]
}

export const ACTIVITY_SKILLS: Record<string, ActivitySkills> = {
  'Athletic Development': {
    fundamental: [
      { name: 'Squat', displayOrder: 1 },
      { name: 'Lateral Lunge', displayOrder: 2 },
      { name: 'Hip Hinge/RDL', displayOrder: 3 },
    ],
    specific: [],
  },

  'Ultimate Frisbee': {
    fundamental: [
      { name: 'Elbow Side Plank', displayOrder: 1 },
      { name: 'Lateral Leap', displayOrder: 2 },
    ],
    specific: [
      { name: 'Throwing', displayOrder: 1 },
      { name: 'Catching', displayOrder: 2 },
      { name: 'Defensive Skill', displayOrder: 3 },
    ],
  },

  'Flag Football': {
    fundamental: [
      { name: 'Horizontal Press (Push-Up)', displayOrder: 1 },
      { name: 'A-Skip', displayOrder: 2 },
    ],
    specific: [
      { name: 'Game Specific Agility', displayOrder: 1 },
      { name: 'Receiving Consistency', displayOrder: 2 },
      { name: 'Defensive Skills', displayOrder: 3 },
    ],
  },

  Tennis: {
    fundamental: [
      { name: 'High Knees', displayOrder: 1 },
      { name: 'Single Leg Hop and Stick', displayOrder: 2 },
    ],
    specific: [
      { name: 'Court Positioning', displayOrder: 1 },
      { name: 'Forehand', displayOrder: 2 },
      { name: 'Backhand', displayOrder: 3 },
    ],
  },

  Squash: {
    fundamental: [
      { name: 'Back Plank', displayOrder: 1 },
      { name: 'Hip/Shoulder Separation', displayOrder: 2 },
    ],
    specific: [
      { name: 'Serving Consistency', displayOrder: 1 },
      { name: 'Forehand Consistency', displayOrder: 2 },
      { name: 'Backhand Consistency', displayOrder: 3 },
    ],
  },

  Volleyball: {
    fundamental: [
      { name: 'Elbow Prone Plank', displayOrder: 1 },
      { name: 'In-Line Lunge', displayOrder: 2 },
    ],
    specific: [
      { name: 'Bumping Accuracy', displayOrder: 1 },
      { name: 'Setting Accuracy', displayOrder: 2 },
      { name: 'Hitting Technique', displayOrder: 3 },
    ],
  },

  'Floor Hockey': {
    fundamental: [
      { name: 'Beast Crawl', displayOrder: 1 },
    ],
    specific: [
      { name: 'Passing/Receiving', displayOrder: 1 },
      { name: 'Movement Without Ball', displayOrder: 2 },
      { name: 'Defensive Skill', displayOrder: 3 },
    ],
  },

  Wrestling: {
    fundamental: [],
    specific: [
      { name: 'Double Leg', displayOrder: 1 },
      { name: 'Half Nelson', displayOrder: 2 },
      { name: 'Switch', displayOrder: 3 },
    ],
  },

  Yoga: {
    fundamental: [],
    specific: [
      { name: 'Plank-Downward Dog-Lunge Combo', displayOrder: 1 },
      { name: 'Warrior 2-Reverse Triangle-Extended Side Angle Combo', displayOrder: 2 },
      { name: 'Extended Side Angle-Half Moon Combo', displayOrder: 3 },
    ],
  },
}

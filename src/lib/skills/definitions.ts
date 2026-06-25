/**
 * Class-specific skill definitions for Standard 1 (Movement Skills).
 *
 * Each activity has two skill categories:
 *   fundamental – core movement competencies assessed across all activities
 *   specific    – sport/activity-specific skills
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
      { name: 'Horizontal Press (Push-Up)', displayOrder: 4 },
      { name: 'Vertical Pull (Flexed-Arm Hang)', displayOrder: 5 },
      { name: 'Core Stability (Plank)', displayOrder: 6 },
    ],
    specific: [],
  },

  'Ultimate Frisbee': {
    fundamental: [
      { name: 'Horizontal Press (Push-Up)', displayOrder: 1 },
      { name: 'A-Skip', displayOrder: 2 },
      { name: 'Hip Hinge/RDL', displayOrder: 3 },
    ],
    specific: [
      { name: 'Throwing Mechanics', displayOrder: 1 },
      { name: 'Catching Consistency', displayOrder: 2 },
      { name: 'Cutting and Field Awareness', displayOrder: 3 },
      { name: 'Defensive Positioning', displayOrder: 4 },
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
      { name: 'Horizontal Press (Push-Up)', displayOrder: 1 },
      { name: 'Lateral Shuffle', displayOrder: 2 },
      { name: 'Hip Hinge/RDL', displayOrder: 3 },
    ],
    specific: [
      { name: 'Forehand Groundstroke', displayOrder: 1 },
      { name: 'Backhand Groundstroke', displayOrder: 2 },
      { name: 'Serve Mechanics', displayOrder: 3 },
      { name: 'Court Positioning and Footwork', displayOrder: 4 },
    ],
  },

  Squash: {
    fundamental: [
      { name: 'Horizontal Press (Push-Up)', displayOrder: 1 },
      { name: 'Lateral Shuffle', displayOrder: 2 },
      { name: 'Hip Hinge/RDL', displayOrder: 3 },
    ],
    specific: [
      { name: 'Forehand Drive', displayOrder: 1 },
      { name: 'Backhand Drive', displayOrder: 2 },
      { name: 'Serve and Return', displayOrder: 3 },
      { name: 'Court Movement and Positioning', displayOrder: 4 },
    ],
  },

  Volleyball: {
    fundamental: [
      { name: 'Squat', displayOrder: 1 },
      { name: 'Vertical Jump', displayOrder: 2 },
      { name: 'Core Stability (Plank)', displayOrder: 3 },
    ],
    specific: [
      { name: 'Forearm Pass (Bump)', displayOrder: 1 },
      { name: 'Overhead Pass (Set)', displayOrder: 2 },
      { name: 'Serving', displayOrder: 3 },
      { name: 'Attacking and Blocking', displayOrder: 4 },
    ],
  },

  'Floor Hockey': {
    fundamental: [
      { name: 'Lateral Lunge', displayOrder: 1 },
      { name: 'A-Skip', displayOrder: 2 },
      { name: 'Core Stability (Plank)', displayOrder: 3 },
    ],
    specific: [
      { name: 'Stick Handling', displayOrder: 1 },
      { name: 'Passing and Receiving', displayOrder: 2 },
      { name: 'Shooting Technique', displayOrder: 3 },
      { name: 'Defensive Positioning', displayOrder: 4 },
    ],
  },

  Wrestling: {
    fundamental: [
      { name: 'Squat', displayOrder: 1 },
      { name: 'Hip Hinge/RDL', displayOrder: 2 },
      { name: 'Core Stability (Plank)', displayOrder: 3 },
      { name: 'Horizontal Press (Push-Up)', displayOrder: 4 },
    ],
    specific: [
      { name: 'Stance and Motion', displayOrder: 1 },
      { name: 'Level Change and Penetration Step', displayOrder: 2 },
      { name: 'Takedown Technique', displayOrder: 3 },
      { name: 'Escape and Reversal', displayOrder: 4 },
    ],
  },

  Yoga: {
    fundamental: [
      { name: 'Squat', displayOrder: 1 },
      { name: 'Hip Hinge/RDL', displayOrder: 2 },
      { name: 'Core Stability (Plank)', displayOrder: 3 },
    ],
    specific: [
      { name: 'Breath Control and Focus', displayOrder: 1 },
      { name: 'Balance Poses', displayOrder: 2 },
      { name: 'Standing Sequence', displayOrder: 3 },
      { name: 'Floor/Seated Sequence', displayOrder: 4 },
    ],
  },
}

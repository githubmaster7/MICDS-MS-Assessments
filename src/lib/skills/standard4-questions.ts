/**
 * Standard 4 — Teamwork and Leadership (understanding component)
 *
 * Standard 4 combines two things per the rubric spreadsheet:
 *   - Demonstration: a student self-rating + a teacher rating of observed
 *     teamwork/leadership, one pair per unit (see StudentStandard4SelfRating
 *     / TeacherStandard4Rating — not modeled as prompts).
 *   - Understanding: one concept question per unit, graded like Standard 3.
 *     These are the prompts below.
 *
 * displayOrder is 1-based within each activity.
 */

export interface Standard4Question {
  promptText: string
  displayOrder: number
}

export const STANDARD4_QUESTIONS: Record<string, Standard4Question[]> = {
  'Athletic Development': [
    {
      promptText: 'When working in a group or team, how does hard work impact positive leadership and teamwork?',
      displayOrder: 1,
    },
  ],

  'Ultimate Frisbee': [
    {
      promptText:
        'One characteristic of a successful group or team is that members listen to each other. What are some specific behaviors or actions that show good listening on a successful team?',
      displayOrder: 1,
    },
  ],

  'Flag Football': [
    {
      promptText: 'Why is showing respect an important part of being a positive leader and a good teammate?',
      displayOrder: 1,
    },
  ],

  Tennis: [
    {
      promptText:
        'Describe a time when you gave positive feedback to a classmate or received positive feedback from one. How did it affect you or your classmate?',
      displayOrder: 1,
    },
  ],

  Squash: [
    {
      promptText: 'Why is being respectful important for someone who wants to be a positive leader and a supportive teammate?',
      displayOrder: 1,
    },
  ],

  Volleyball: [
    {
      promptText:
        'A key part of a great team is that each member understands their role. Why is it important for team members to know their roles in order for the team to be successful?',
      displayOrder: 1,
    },
  ],

  'Floor Hockey': [
    {
      promptText:
        'Describe a time during this unit when you or a classmate showed strong focus. How did that focus affect the rest of the class?',
      displayOrder: 1,
    },
  ],

  Wrestling: [
    {
      promptText:
        "One characteristic of a great team is that it creates a safe and supportive environment for all team members. Why is this important for the team's or class's success? Explain your answer.",
      displayOrder: 1,
    },
  ],

  Yoga: [
    {
      promptText:
        'A characteristic of a successful group or team is that they listen to each other. What would this look like on a successful team?',
      displayOrder: 1,
    },
  ],
}

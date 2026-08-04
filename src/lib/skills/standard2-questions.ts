/**
 * Standard 2 — Movement Concepts, Strategies, and Tactics
 *
 * Each activity has two concept questions students answer to demonstrate
 * understanding of movement concepts and the strategies/tactics used in that
 * sport. Source: "Standard 2" rubric spreadsheet, 1st Semester.
 *
 * displayOrder is 1-based within each activity.
 */

export interface Standard2Question {
  promptText: string
  displayOrder: number
}

export const STANDARD2_QUESTIONS: Record<string, Standard2Question[]> = {
  'Athletic Development': [
    {
      promptText: 'What are the benefits of using the force platform to track movement data?',
      displayOrder: 1,
    },
    {
      promptText:
        "Why are the exercises and activities we do in athletic development good for people that don't participate in athletics?",
      displayOrder: 2,
    },
  ],

  'Ultimate Frisbee': [
    {
      promptText: 'Describe how you would teach someone to throw a backhand.',
      displayOrder: 1,
    },
    {
      promptText:
        'Many sports have a transfer of skills, strategies, tactics, and/or energy systems (similar intensities). List a sport (Level 3) or sports (Level 4) that have a transfer to the game of ultimate and explain what transfers.',
      displayOrder: 2,
    },
  ],

  'Flag Football': [
    {
      promptText: 'Explain three of the receiving routes taught during this unit.',
      displayOrder: 1,
    },
    {
      promptText: 'Describe two different defensive strategies used in football.',
      displayOrder: 2,
    },
  ],

  Tennis: [
    {
      promptText: 'How would you teach someone to hit a forehand?',
      displayOrder: 1,
    },
    {
      promptText: 'Describe at least two strategies used in tennis (more than two=Level 4).',
      displayOrder: 2,
    },
  ],

  Squash: [
    {
      promptText: 'If you were to teach someone how to have a successful serve, what would you tell them?',
      displayOrder: 1,
    },
    {
      promptText: 'Describe a strategy used in squash',
      displayOrder: 2,
    },
  ],

  Volleyball: [
    {
      promptText: 'How do you increase your chance of making a good forearm pass?',
      displayOrder: 1,
    },
    {
      promptText: 'Describe the proper technique for setting a ball.',
      displayOrder: 2,
    },
  ],

  'Floor Hockey': [
    {
      promptText: 'If you were to teach someone how to pass properly, what would you tell them?',
      displayOrder: 1,
    },
    {
      promptText: 'Describe a strategy that would help an offense score in floor hockey.',
      displayOrder: 2,
    },
  ],

  Wrestling: [
    {
      promptText: 'Describe the technique for the double leg takedown.',
      displayOrder: 1,
    },
    {
      promptText: 'Describe the proper technique for the switch.',
      displayOrder: 2,
    },
  ],

  Yoga: [
    {
      promptText: 'How can you increase the difficulty of a yoga pose?',
      displayOrder: 1,
    },
    {
      promptText:
        'Describe the proper alignment of your front leg when transitioning between Warrior 2, Reverse Warrior, and Extended Side Angle. Explain why maintaining this alignment is important for both safety and effectiveness.',
      displayOrder: 2,
    },
  ],
}

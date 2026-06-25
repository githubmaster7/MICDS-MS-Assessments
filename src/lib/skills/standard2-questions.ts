/**
 * Standard 2 — Health-Related Fitness Knowledge
 *
 * Each activity has a set of written-response prompts that students answer
 * to demonstrate understanding of health-related fitness concepts (FITT
 * principle, energy systems, body composition, training adaptations, etc.)
 * as they apply to that specific activity context.
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
      promptText:
        'Describe the FITT principle (Frequency, Intensity, Time, Type) and explain how you applied it during this Athletic Development rotation.',
      displayOrder: 1,
    },
    {
      promptText:
        'Explain the difference between muscular strength and muscular endurance. Provide an example of each from the exercises we practiced.',
      displayOrder: 2,
    },
    {
      promptText:
        'What is the principle of progressive overload, and how would you use it to continue improving your fitness after this rotation ends?',
      displayOrder: 3,
    },
  ],

  'Ultimate Frisbee': [
    {
      promptText:
        'Identify the primary components of health-related fitness used in Ultimate Frisbee (e.g., cardiovascular endurance, flexibility) and explain how each is challenged during a game.',
      displayOrder: 1,
    },
    {
      promptText:
        'Describe how the cardiovascular system responds during sustained Ultimate Frisbee play. What changes do you notice in your breathing and heart rate?',
      displayOrder: 2,
    },
    {
      promptText:
        'How could you use the FITT principle to design a week of off-season training specifically for Ultimate Frisbee performance?',
      displayOrder: 3,
    },
  ],

  'Flag Football': [
    {
      promptText:
        'Explain how Flag Football develops both anaerobic and aerobic fitness. Give specific examples from gameplay.',
      displayOrder: 1,
    },
    {
      promptText:
        'Identify two health-related fitness components that are most important for a flag football player and justify your choices.',
      displayOrder: 2,
    },
    {
      promptText:
        'Using the FITT principle, describe a training plan you could follow for two weeks to improve your performance in flag football.',
      displayOrder: 3,
    },
  ],

  Tennis: [
    {
      promptText:
        'Describe the fitness components (e.g., agility, cardiovascular endurance, flexibility) most essential to tennis performance and explain how each is used during a match.',
      displayOrder: 1,
    },
    {
      promptText:
        'Explain the concept of active recovery and why it matters between points and games in tennis.',
      displayOrder: 2,
    },
    {
      promptText:
        'How does regular tennis play contribute to long-term health? Connect at least two health-related fitness components to specific health benefits.',
      displayOrder: 3,
    },
  ],

  Squash: [
    {
      promptText:
        'Squash is described as one of the most demanding racquet sports. Identify the health-related fitness components it primarily develops and explain why.',
      displayOrder: 1,
    },
    {
      promptText:
        'Describe how your heart rate changes during a squash rally versus the rest period between points. What does this tell you about energy systems?',
      displayOrder: 2,
    },
    {
      promptText:
        'Using the FITT principle, outline how a squash player could structure three training sessions per week to improve cardiovascular endurance.',
      displayOrder: 3,
    },
  ],

  Volleyball: [
    {
      promptText:
        'Explain how volleyball uses both aerobic and anaerobic energy systems. Provide specific examples from a game situation.',
      displayOrder: 1,
    },
    {
      promptText:
        'Identify the health-related fitness components most important for a volleyball player and explain how each contributes to performance.',
      displayOrder: 2,
    },
    {
      promptText:
        'Describe how you could use the FITT principle to design a conditioning program that prepares you for a volleyball season.',
      displayOrder: 3,
    },
  ],

  'Floor Hockey': [
    {
      promptText:
        'Describe the cardiovascular demands of floor hockey. How does sustained play benefit heart health over time?',
      displayOrder: 1,
    },
    {
      promptText:
        'Identify two health-related fitness components that floor hockey develops and explain how each is used during a game.',
      displayOrder: 2,
    },
    {
      promptText:
        'How would you apply the FITT principle to train specifically for the physical demands of floor hockey?',
      displayOrder: 3,
    },
  ],

  Wrestling: [
    {
      promptText:
        'Explain how wrestling develops muscular strength, muscular endurance, and flexibility. Give examples of moves or positions that require each.',
      displayOrder: 1,
    },
    {
      promptText:
        'Describe the energy systems used during a wrestling match. Why is both aerobic and anaerobic fitness important for a wrestler?',
      displayOrder: 2,
    },
    {
      promptText:
        'Using the FITT principle, design a two-week off-season strength and conditioning program for a middle school wrestler.',
      displayOrder: 3,
    },
  ],

  Yoga: [
    {
      promptText:
        'Identify the health-related fitness components that yoga primarily develops (e.g., flexibility, muscular endurance, body composition) and explain how regular practice improves each.',
      displayOrder: 1,
    },
    {
      promptText:
        'Explain the relationship between yoga and stress management. How does controlled breathing affect your body during practice?',
      displayOrder: 2,
    },
    {
      promptText:
        'How could you incorporate the FITT principle into a personal yoga practice to continue improving flexibility and core strength outside of class?',
      displayOrder: 3,
    },
  ],
}

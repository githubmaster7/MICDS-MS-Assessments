/**
 * Standard 3 — Health, Fitness, and Nutrition Concepts
 *
 * Each activity has one concept question (Athletic Development has two)
 * students answer to demonstrate understanding of health/fitness/nutrition
 * concepts. Source: "Standard 3" rubric spreadsheet.
 *
 * displayOrder is 1-based within each activity.
 */

export interface Standard3Question {
  promptText: string
  displayOrder: number
}

export const STANDARD3_QUESTIONS: Record<string, Standard3Question[]> = {
  'Athletic Development': [
    {
      promptText: 'What are the benefits of improving strength?',
      displayOrder: 1,
    },
    {
      promptText:
        "List the three energy systems and describe the intensities when each one becomes your body's main method for using energy.",
      displayOrder: 2,
    },
  ],

  'Ultimate Frisbee': [
    {
      promptText:
        'Ultimate is a very aerobic sport because it involves constant running. How can playing a fun, active game like ultimate help improve your ability to learn in the classroom? Explain your thinking.',
      displayOrder: 1,
    },
  ],

  'Flag Football': [
    {
      promptText: 'How does proper hydration impact your body when you are playing a sport?',
      displayOrder: 1,
    },
  ],

  Tennis: [
    {
      promptText:
        'Playing tennis provides a good amount of aerobic exercise. Aerobic exercise helps improve the function of your lungs. Describe how exercise improves your lungs.',
      displayOrder: 1,
    },
  ],

  Squash: [
    {
      promptText:
        'The stress on your bones from playing squash helps make your bones stronger. This only occurs when you have adequate vitamin D and calcium. Why does your body need vitamin D and calcium to help make your bones stronger?',
      displayOrder: 1,
    },
  ],

  Volleyball: [
    {
      promptText:
        'Volleyball involves short bursts of fast movement during rallies, followed by brief rest periods. How can this type of movement help improve the health and function of your blood vessels? Explain your answer.',
      displayOrder: 1,
    },
  ],

  'Floor Hockey': [
    {
      promptText:
        'Playing floor hockey is a good form of aerobic exercise, which helps improve how your lungs work. How does regular exercise like this help your lungs become stronger and more efficient? Explain your answer.',
      displayOrder: 1,
    },
  ],

  Wrestling: [
    {
      promptText:
        'Wrestling is a physically intense sport that mainly uses the glycolytic (lactic acid) system. What can a wrestler do to improve their glycolytic (lactic acid) system?',
      displayOrder: 1,
    },
  ],

  Yoga: [
    {
      promptText:
        'Describe what is happening inside the body when the parasympathetic and sympathetic nervous systems are stimulated.',
      displayOrder: 1,
    },
  ],
}

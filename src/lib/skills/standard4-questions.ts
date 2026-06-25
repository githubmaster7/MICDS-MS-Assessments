/**
 * Standard 4 — Physical Activity and Health / Values, Responsibility,
 * and Lifelong Participation
 *
 * Standard 4 is primarily a single holistic teacher rating (1–4) and an
 * optional student self-rating.  These prompts support the student's
 * self-reflection that feeds into that rating.
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
      promptText:
        'Reflect on your overall effort and attitude during the Athletic Development rotation. How consistently did you give full effort, and what evidence supports your assessment?',
      displayOrder: 1,
    },
    {
      promptText:
        'How has this rotation changed (or reinforced) your intentions to be physically active outside of school? Describe specific activities you plan to pursue.',
      displayOrder: 2,
    },
  ],

  'Ultimate Frisbee': [
    {
      promptText:
        'Rate your engagement and responsibility during the Ultimate Frisbee rotation. Give two specific examples that illustrate the rating you chose.',
      displayOrder: 1,
    },
    {
      promptText:
        'Explain how playing Ultimate Frisbee could be part of a lifelong physically active lifestyle. Are there recreational leagues, clubs, or community opportunities you could pursue?',
      displayOrder: 2,
    },
  ],

  'Flag Football': [
    {
      promptText:
        'Describe your level of responsibility during the Flag Football rotation — including preparation, effort, and behavior. Where did you excel, and where could you improve?',
      displayOrder: 1,
    },
    {
      promptText:
        'Explain how participating in recreational or intramural flag football could support your long-term health and social well-being.',
      displayOrder: 2,
    },
  ],

  Tennis: [
    {
      promptText:
        'Reflect on your commitment and responsibility during Tennis. Provide evidence (specific behaviors or moments) that supports your self-evaluation.',
      displayOrder: 1,
    },
    {
      promptText:
        'Tennis is widely available as a lifelong recreational activity. Identify the resources in your community that would allow you to continue playing after middle school.',
      displayOrder: 2,
    },
  ],

  Squash: [
    {
      promptText:
        'Evaluate your effort, responsibility, and attitude during the Squash rotation. Be honest about moments of strong engagement and moments where you fell short.',
      displayOrder: 1,
    },
    {
      promptText:
        'How has learning squash opened (or not opened) the possibility of playing it beyond school? What would you need to continue?',
      displayOrder: 2,
    },
  ],

  Volleyball: [
    {
      promptText:
        'Assess your personal responsibility during Volleyball — including showing up prepared, supporting teammates, and maintaining effort. Provide specific examples.',
      displayOrder: 1,
    },
    {
      promptText:
        'Volleyball can be played recreationally throughout life (beach, indoor, casual). Describe how you might incorporate it into a healthy, active lifestyle long-term.',
      displayOrder: 2,
    },
  ],

  'Floor Hockey': [
    {
      promptText:
        'Reflect on your engagement and accountability during the Floor Hockey rotation. Describe moments where you showed personal responsibility and moments you would handle differently.',
      displayOrder: 1,
    },
    {
      promptText:
        'How does participating in floor hockey connect to the value of lifetime physical activity? Identify similar sports or activities you could pursue in your community.',
      displayOrder: 2,
    },
  ],

  Wrestling: [
    {
      promptText:
        'Evaluate your responsibility and safety-consciousness during the Wrestling rotation. How did you ensure a safe and respectful environment for yourself and your partner?',
      displayOrder: 1,
    },
    {
      promptText:
        'Reflect on how wrestling has or has not influenced your interest in pursuing physical activity (wrestling clubs, martial arts, fitness training) beyond this class.',
      displayOrder: 2,
    },
  ],

  Yoga: [
    {
      promptText:
        'Assess your personal engagement during the Yoga rotation. How fully did you participate in both the physical and mindfulness components of each class?',
      displayOrder: 1,
    },
    {
      promptText:
        'Describe a specific plan for incorporating yoga or mindfulness into your weekly routine. How would this support your long-term physical and mental health?',
      displayOrder: 2,
    },
  ],
}

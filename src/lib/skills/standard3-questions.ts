/**
 * Standard 3 — Psychological and Social Dimensions of Physical Activity
 *
 * Prompts ask students to reflect on goal-setting, motivation, teamwork,
 * sportsmanship, and the social and emotional aspects of participation in
 * each specific activity.
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
      promptText:
        'Set a SMART goal (Specific, Measurable, Achievable, Relevant, Time-bound) that you worked toward during this Athletic Development rotation. Describe your progress and what helped or hindered you.',
      displayOrder: 1,
    },
    {
      promptText:
        'Describe a moment when you felt discouraged during training and explain the strategy you used (or could use) to maintain motivation.',
      displayOrder: 2,
    },
    {
      promptText:
        'How did working alongside classmates in the weight room affect your effort and attitude? Explain how peer support can be both helpful and distracting.',
      displayOrder: 3,
    },
  ],

  'Ultimate Frisbee': [
    {
      promptText:
        'Describe a situation in Ultimate Frisbee where your team had to make a quick collective decision. How did communication affect the outcome?',
      displayOrder: 1,
    },
    {
      promptText:
        'Explain the concept of "Spirit of the Game" in Ultimate Frisbee and give an example of how you demonstrated it during this rotation.',
      displayOrder: 2,
    },
    {
      promptText:
        'Set a SMART personal goal for improving one social or emotional skill (e.g., encouraging teammates, managing frustration) in a team sport setting.',
      displayOrder: 3,
    },
  ],

  'Flag Football': [
    {
      promptText:
        'Describe a time during flag football when your team disagreed on strategy. How was the conflict resolved, and what did you learn about teamwork?',
      displayOrder: 1,
    },
    {
      promptText:
        'Explain what good sportsmanship looks like in flag football — both when your team is winning and when it is losing.',
      displayOrder: 2,
    },
    {
      promptText:
        'Set a SMART goal related to a social skill (e.g., leadership, communication, inclusivity) you want to develop through flag football participation.',
      displayOrder: 3,
    },
  ],

  Tennis: [
    {
      promptText:
        'Tennis requires self-management on the court. Describe a moment when you had to control frustration or nervousness and explain the strategy you used.',
      displayOrder: 1,
    },
    {
      promptText:
        'How does playing tennis with a partner or opponent differ socially from a team sport? What unique social skills does it require?',
      displayOrder: 2,
    },
    {
      promptText:
        'Set a SMART goal for improving your mental focus or emotional regulation during tennis practice or match play.',
      displayOrder: 3,
    },
  ],

  Squash: [
    {
      promptText:
        'Squash is played one-on-one in close quarters. How does that environment affect your focus, sportsmanship, and respect for your opponent?',
      displayOrder: 1,
    },
    {
      promptText:
        'Describe a challenge you faced during squash (skill, physical, or mental) and explain the self-talk or strategy you used to push through it.',
      displayOrder: 2,
    },
    {
      promptText:
        'Set a SMART goal for a psychological dimension of performance (e.g., staying calm under pressure, recovering quickly from errors) in squash.',
      displayOrder: 3,
    },
  ],

  Volleyball: [
    {
      promptText:
        'Describe the communication strategies your team used during volleyball. How did verbal and non-verbal communication affect your performance?',
      displayOrder: 1,
    },
    {
      promptText:
        'Explain how you responded to making an error during a volleyball game. What does healthy mistake-recovery look like in a team sport?',
      displayOrder: 2,
    },
    {
      promptText:
        'Set a SMART goal focused on your role as a teammate — including both supporting others and managing your own emotions during competition.',
      displayOrder: 3,
    },
  ],

  'Floor Hockey': [
    {
      promptText:
        'Describe how floor hockey requires both individual responsibility and team cooperation. Give a specific example from this rotation.',
      displayOrder: 1,
    },
    {
      promptText:
        'Explain what actions you took to make floor hockey feel welcoming and inclusive for all skill levels in your class.',
      displayOrder: 2,
    },
    {
      promptText:
        'Set a SMART goal related to one social skill (e.g., being a positive leader, communicating on the ice, helping a struggling teammate) for this activity.',
      displayOrder: 3,
    },
  ],

  Wrestling: [
    {
      promptText:
        'Wrestling involves physical contact and requires a high degree of mutual respect. Explain how you demonstrated respect for your partner during drilling and sparring.',
      displayOrder: 1,
    },
    {
      promptText:
        'Describe the emotional challenges of wrestling (e.g., getting taken down, feeling physically outmatched) and how you managed them.',
      displayOrder: 2,
    },
    {
      promptText:
        'Set a SMART goal that addresses the mental toughness or sportsmanship aspect of wrestling competition or practice.',
      displayOrder: 3,
    },
  ],

  Yoga: [
    {
      promptText:
        'Describe how the mindfulness and breathing practices in yoga affected your stress or anxiety levels during this rotation.',
      displayOrder: 1,
    },
    {
      promptText:
        'Explain how yoga encourages a non-competitive mindset. How did that affect how you approached your own practice and the atmosphere in class?',
      displayOrder: 2,
    },
    {
      promptText:
        'Set a SMART goal for integrating a yoga-based mindfulness or stress-management practice into your daily life outside of PE class.',
      displayOrder: 3,
    },
  ],
}

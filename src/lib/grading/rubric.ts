export interface ScoreBreakdownRow {
  score: string;
  description: string;
}

export interface StandardRubric {
  standardNumber: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  levels: Record<1 | 2 | 3 | 4, string>;
  scoreBreakdown: ScoreBreakdownRow[];
  directions?: string;
  honorCode?: string[];
}

// Shared across all four standards — the score-to-percentage mapping is now
// unified (see calculateStandardScore in ./standard-score.ts), so this table
// must stay in sync with that function's exact thresholds; it's the only
// other place these numbers are written down, purely for display.
const UNIFIED_SCORE_BREAKDOWN: ScoreBreakdownRow[] = [
  { score: "4", description: "Everything is green, with more than half of it bright green" },
  { score: "3.5", description: "75% or more green, but doesn't meet the criteria for a 4 above" },
  { score: "3", description: "50-74% green, no major deficiencies" },
  { score: "2.5", description: "40-49% green, no major deficiencies" },
  { score: "2", description: "30-39% green, or 1-3 major deficiencies" },
  { score: "1.5", description: "21-29% green, or 4-5 major deficiencies" },
  { score: "1", description: "20% or below green, 6 or more major deficiencies, or missing" },
];

export const SCORING_RUBRIC: Record<1 | 2 | 3 | 4, StandardRubric> = {
  1: {
    standardNumber: 1,
    name: "Movement Skills",
    description:
      "This standard assesses movement skills. The total score for this standard contributes to 1/4 of your grade. Scores can be interpreted by the following criteria:",
    levels: {
      1: "You do not demonstrate the skill or make very little effort to perform the skill",
      2: "You work on performing the skill but do not perform the skill at an adequate level",
      3: "You can perform the skill at an adequate level",
      4: "You can perform the skill at an exceptional level",
    },
    scoreBreakdown: UNIFIED_SCORE_BREAKDOWN,
  },
  2: {
    standardNumber: 2,
    name: "Movement Concepts & Sport Strategies",
    description:
      "This standard assesses understanding of movement concepts as well as strategies and tactics used in sports. The total score of this standard contributes to 1/4 of the grade. The standard is calculated by the following criteria:",
    levels: {
      1: "You have not answered many questions",
      2: "You are developing with your understanding of the concepts",
      3: "You understand what we want you to know",
      4: "You excel at understanding what we want you to know",
    },
    scoreBreakdown: UNIFIED_SCORE_BREAKDOWN,
    directions:
      'Read the questions for the unit you completed. Place the cursor over the question in order to see the rubric that will be used to assess your answer. Be sure you understand the rubric before answering the question. If you have a question about the rubric, ask your teacher. Put your answer for each question in the column labeled "Answers". You can type your answer in the box or provide a link to a video of you explaining your answer. Be sure to hit "enter" once your are finished with your answer.',
    honorCode: [
      "MICDS HONOR CODE: USE ONLY YOUR BRAIN TO ANSWER THESE QUESTIONS (NO AI, GOOGLE, CANVAS RESOURCES, ETC.)",
      "YOU MAY ONLY USE RESOURCES IF YOUR ANSWER IS RATED AS A 1 OR A 2",
    ],
  },
  3: {
    standardNumber: 3,
    name: "Health, Fitness & Nutrition",
    description:
      "This standard assesses understanding of health, fitness, and nutrition concepts. The total score of this standard contributes to 1/4 of the grade. The standard is calculated by the following criteria:",
    levels: {
      1: "You have not answered many questions",
      2: "You are developing with your understanding of the concepts",
      3: "You understand what we want you to know",
      4: "You excel at understanding what we want you to know",
    },
    scoreBreakdown: UNIFIED_SCORE_BREAKDOWN,
    directions:
      'Read the questions for the unit you completed. Place the cursor over the question in order to see the rubric that will be used to assess your answer. Be sure you understand the rubric before answering the question. If you have a question about the rubric, ask your teacher. Put your answer for each question in the column labeled "Answers". You can type your answer in the box or provide a link to a video of you explaining your answer. Be sure to hit "enter" once your are finished with your answer.',
    honorCode: [
      "MICDS HONOR CODE: USE ONLY YOUR BRAIN TO ANSWER THESE QUESTIONS (NO AI, GOOGLE, CANVAS RESOURCES, ETC.)",
      "YOU MAY ONLY USE RESOURCES IF YOUR ANSWER IS RATED AS A 1 OR A 2",
    ],
  },
  4: {
    standardNumber: 4,
    name: "Teamwork & Leadership",
    description:
      "This standard assesses both understanding and demonstration of positive teamwork and leadership. The demonstration of positive teamwork and leadership is determined by student self-rating and teacher rating. Students provide a self-rating on how well they feel they demonstrated positive teamwork and leadership. The teachers also provide a rating of their perception on how well the student demonstrated positive leadership and teamwork. Understanding of positive leadership and teamwork is determined by the answering of the questions below.",
    levels: {
      1: "You have not answered many questions and/or you have not rated your demonstration of teamwork and leadership",
      2: "You are developing with your understanding and demonstration of proper teamwork and leadership",
      3: "You understand and demonstrate proper teamwork and leadership at an appropriate level",
      4: "You excel with your understanding and demonstration of proper teamwork and leadership",
    },
    scoreBreakdown: UNIFIED_SCORE_BREAKDOWN,
    directions:
      'In the green sections, rate your own demonstration of positive teamwork and leadership then explain why you gave yourself that score. For the questions, read the questions for the unit you completed. Place the cursor over the question in order to see the rubric that will be used to assess your answer. Be sure you understand the rubric before answering the question. If you have a question about the rubric, ask your teacher. You can type your answer in the box or provide a link to a video of you explaining your answer. Be sure to click "enter" once you are finished with your answer.',
  },
};

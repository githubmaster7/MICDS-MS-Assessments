// This file defines what rows/questions exist.
// To match your spreadsheet "almost exactly", you will replace these labels/rows with the sheet’s text.

const APP = {
  standards: [
    {
      id: "s1",
      nav: "Standard 1",
      title: "Standard 1: Movement Skills",
      type: "skills", // spreadsheet table with skill rows
      rows: [
        { key: "throwing", label: "Throwing" },
        { key: "catching", label: "Catching" },
        { key: "kicking", label: "Kicking" },
        { key: "striking", label: "Striking" }
      ]
    },
    {
      id: "s2",
      nav: "Standard 2",
      title: "Standard 2: Movement Concepts + Sport Strategies",
      type: "questions", // prompt + student response + teacher score + reassessment
      rows: [
        { key: "s2q1", label: "Question 1", prompt: "Explain one offensive strategy you used." },
        { key: "s2q2", label: "Question 2", prompt: "Explain one defensive strategy you used." }
      ]
    },
    {
      id: "s3",
      nav: "Standard 3",
      title: "Standard 3: Health + Fitness + Nutrition",
      type: "questions",
      rows: [
        { key: "s3q1", label: "Question 1", prompt: "Describe one benefit of regular physical activity." },
        { key: "s3q2", label: "Question 2", prompt: "Give one example of a balanced meal and why." }
      ]
    },
    {
      id: "s4",
      nav: "Standard 4",
      title: "Standard 4: Teamwork + Leadership",
      type: "mixed", // ratings table + questions
      ratings: [
        { key: "coop", label: "Cooperation" },
        { key: "lead", label: "Leadership" },
        { key: "respect", label: "Respect" }
      ],
      rows: [
        { key: "s4q1", label: "Question 1", prompt: "Describe how you demonstrated teamwork/leadership." }
      ]
    },
    {
      id: "atl",
      nav: "ATL",
      title: "Approach to Learning",
      type: "atl",
      effortRatings: [
        { key: "effort", label: "Puts forth effort to learn" },
        { key: "focus", label: "Focus / Preparedness" }
      ]
    }
  ],
  weights: { s1: 0.25, s2: 0.25, s3: 0.25, s4: 0.25 },
  micdsDomain: "@micds.org",
  teacherWhitelist: ["prosen@micds.org"] // add more later
};

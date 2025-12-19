// data.js
export const TABS = [
  { id: "scores", label: "Scores and Grades" },
  { id: "s1", label: "Movement Skills (Standard 1)" },
  { id: "s2", label: "Movement Concepts (Standard 2)" },
  { id: "s3", label: "Health and Fitness (Standard 3)" },
  { id: "s4", label: "Teamwork and Leadership (Standard 4)" },
  { id: "atl", label: "Approach to Learning" },
];

// Minimal but expandable structure.
// Keys MUST be stable because storage uses them.
export const RUBRIC = {
  s1: [
    { key: "s1_q1", unit: "Athletic Development", concept: "Describe one movement skill you improved and how.", proofLabel: "Proof of Understanding" },
    { key: "s1_q2", unit: "Ultimate", concept: "Explain how to throw a backhand (steps + cues).", proofLabel: "Proof of Understanding" },
    { key: "s1_q3", unit: "Flag Football", concept: "Explain three receiving routes taught.", proofLabel: "Proof of Understanding" },
  ],
  s2: [
    { key: "s2_q1", unit: "Athletic Development", concept: "Benefits of using a force platform to track movement data?", proofLabel: "Proof of Understanding" },
    { key: "s2_q2", unit: "Ultimate", concept: "List transferable skills from another sport and explain transfer.", proofLabel: "Proof of Understanding" },
    { key: "s2_q3", unit: "Flag Football", concept: "Describe one strategy/tactic and why it works.", proofLabel: "Proof of Understanding" },
  ],
  s3: [
    { key: "s3_q1", unit: "Athletic Development", concept: "Explain benefits of improving strength.", proofLabel: "Proof of Understanding" },
    { key: "s3_q2", unit: "Ultimate", concept: "Describe the three energy systems and when each dominates.", proofLabel: "Proof of Understanding" },
    { key: "s3_q3", unit: "Yoga", concept: "What happens in the body when parasympathetic system is stimulated?", proofLabel: "Proof of Understanding" },
  ],
  s4: [
    { key: "s4_q1", unit: "Athletic Development", concept: "How did you show positive teamwork/leadership?", proofLabel: "Proof of Understanding" },
    { key: "s4_q2", unit: "Ultimate", concept: "Describe a time you improved team communication.", proofLabel: "Proof of Understanding" },
    { key: "s4_q3", unit: "Flag Football", concept: "Explain how you supported teammates during practice/game.", proofLabel: "Proof of Understanding" },
  ],
  atl: [
    { key: "atl_late", unit: "ATL", concept: "S1 Days Late and Unprepared (# classes)", type: "number", min: 0, max: 20 },
    { key: "atl_effort", unit: "ATL", concept: "Puts Forth Effort to Learn", type: "score" },
    { key: "atl_follow", unit: "ATL", concept: "Follows Instructions", type: "score" },
    { key: "atl_task", unit: "ATL", concept: "Stays On Task", type: "score" },
  ],
};

export const SCORE_LEVELS = [1, 2, 3, 4];

export function scoreBadgeClass(n){
  if (n === 4) return "s4";
  if (n === 3) return "s3";
  if (n === 2) return "s2";
  if (n === 1) return "s1";
  return "";
}

// Teacher overrides student, everywhere.
export function effectiveScore(studentScore, teacherScore){
  if (teacherScore !== null && teacherScore !== undefined && teacherScore !== "") return Number(teacherScore);
  if (studentScore !== null && studentScore !== undefined && studentScore !== "") return Number(studentScore);
  return null;
}

export function computeStandardAverage(items, record){
  // items: array of RUBRIC[std]
  // record: student record
  const vals = [];
  for (const it of items){
    if (it.type === "number") continue; // ATL number isn’t a 1-4 score
    const s = record?.student?.scores?.[it.key] ?? null;
    const t = record?.teacher?.scores?.[it.key] ?? null;
    const eff = effectiveScore(s, t);
    if (eff !== null) vals.push(eff);
  }
  if (!vals.length) return null;
  return vals.reduce((a,b)=>a+b,0) / vals.length;
}

export function computeOverallGrade(record){
  // Average of Standards 1–4 (25% each), using effective scores.
  const s1 = computeStandardAverage(RUBRIC.s1, record);
  const s2 = computeStandardAverage(RUBRIC.s2, record);
  const s3 = computeStandardAverage(RUBRIC.s3, record);
  const s4 = computeStandardAverage(RUBRIC.s4, record);
  const arr = [s1, s2, s3, s4].filter(v => v !== null);
  if (!arr.length) return null;
  return arr.reduce((a,b)=>a+b,0) / arr.length;
}

export function atlScoreFromLateCount(n){
  // From your screenshot: 0→4, 1-3→3, 4-6→2, >6→1
  const x = Number(n || 0);
  if (x <= 0) return 4;
  if (x >= 1 && x <= 3) return 3;
  if (x >= 4 && x <= 6) return 2;
  return 1;
}

export function computePopulationCounts(allRecords, keys){
  // keys = array of item keys; count effective scores across all students
  const counts = { 1:0, 2:0, 3:0, 4:0 };
  for (const r of allRecords){
    for (const k of keys){
      const s = r?.student?.scores?.[k] ?? null;
      const t = r?.teacher?.scores?.[k] ?? null;
      const eff = effectiveScore(s, t);
      if (eff !== null) counts[eff] = (counts[eff] || 0) + 1;
    }
  }
  return counts;
}

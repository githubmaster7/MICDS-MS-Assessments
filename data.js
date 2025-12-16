// Based on the uploaded MICDS assessment sheet structure.  [oai_citation:8‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)

const UNITS = [
  "Athletic Development",
  "Ultimate Frisbee",
  "Flag Football",
  "Tennis",
  "Squash",
  "Volleyball",
  "Floor Hockey",
  "Wrestling",
  "Yoga"
];

// Standard 1 skills (condensed into one list; each rated 1–4)
// 4=bright green, 3=green, 2=yellow, 1=red; then converted using sheet rules  [oai_citation:9‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)
const S1_SKILLS = [
  "Squat (Athletic Development)",
  "Lateral Lunge (Athletic Development)",
  "Hip Hinge/RDL (Athletic Development)",
  "Horizontal Press (Push-Up) (Flag Football)",
  "A-Skip (Flag Football)",
  "Elbow Prone Plank (Volleyball)",
  "In-Line Lunge (Volleyball)",
  "Elbow Side Plank (Ultimate)",
  "Lateral Leap (Ultimate)",
  "Beast Crawl (Floor Hockey)",
  "High Knees (Tennis)",
  "Single Leg Hop and Stick (Tennis)",
  "Back Plank (Squash)",
  "Hip/Shoulder Separation (Squash)"
];

const RUBRICS = {
  // Standard 2 rubrics [1]-[18]  [oai_citation:10‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)
  1: "Lvl 1: Unable to provide a reason\nLvl 2: 1 or plausible but incorrect reason\nLvl 3: 2 reasons\nLvl 4: >2 reasons",
  2: "Lvl 1: Unable to provide an explanation\nLvl 2: Plausible but inaccurate\nLvl 3: Accurate explanation\nLvl 4: More than one explanation",
  3: "Lvl 1: No description\nLvl 2: 1 cue\nLvl 3: 2 cues\nLvl 4: 3+ cues",
  4: "Lvl 1: No explanation\nLvl 2: Sport but no transfer explanation\nLvl 3: Sport + accurate transfer\nLvl 4: >1 sport + accurate transfers",
  5: "Lvl 1: No route\nLvl 2: 1–2 routes\nLvl 3: 3 routes\nLvl 4: all 3 + when each works best",
  6: "Lvl 1: No description\nLvl 2: 1 strategy\nLvl 3: 2 accurate strategies\nLvl 4: 2 accurate + how they work",
  7: "Lvl 1: No explanation\nLvl 2: 1 cue\nLvl 3: 2+ cues\nLvl 4: >2 cues",
  8: "Lvl 1: No strategy\nLvl 2: plausible but inaccurate\nLvl 3: 2 accurate strategies\nLvl 4: >2 + why effective",
  9: "Lvl 1: No description\nLvl 2: 1 cue\nLvl 3: 2+ cues\nLvl 4: >2 cues",
  10:"Lvl 1: No description\nLvl 2: plausible but incorrect\nLvl 3: proper strategy\nLvl 4: proper + how it works",
  11:"Lvl 1: No cue\nLvl 2: 1 cue\nLvl 3: 2 cues\nLvl 4: >2 cues",
  12:"Lvl 1: No cue\nLvl 2: 1 cue\nLvl 3: 2 cues\nLvl 4: >2 cues",
  13:"Lvl 1: No cue\nLvl 2: 1 cue\nLvl 3: 2 cues\nLvl 4: >2 cues",
  14:"Lvl 1: No strategy\nLvl 2: plausible but inaccurate\nLvl 3: 1 accurate strategy\nLvl 4: 2+ strategies + why effective",
  15:"Lvl 1: No description\nLvl 2: 1 cue\nLvl 3: 2+ cues\nLvl 4: >2 cues",
  16:"Lvl 1: No description\nLvl 2: 1 cue\nLvl 3: 2+ cues\nLvl 4: >2 cues",
  17:"Lvl 1: No explanation\nLvl 2: plausible but inaccurate/incomplete\nLvl 3: accurate\nLvl 4: accurate + example",
  18:"Lvl 1: No explanation\nLvl 2: plausible but inaccurate/incomplete\nLvl 3: alignment OR why\nLvl 4: alignment AND why",

  // Standard 3 rubrics [19]-[28]  [oai_citation:11‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)
  19:"Lvl 1: No benefit\nLvl 2: 1–2 benefits\nLvl 3: 3+ benefits\nLvl 4: >3 benefits",
  20:"Lvl 1: Can't identify\nLvl 2: some systems or wrong intensities\nLvl 3: all 3 systems + correct intensities\nLvl 4: + sport example for each",
  21:"Lvl 1: No answer\nLvl 2: plausible but incorrect\nLvl 3: 1+ reason\nLvl 4: >1 reason",
  22:"Lvl 1: No improvement\nLvl 2: 1 improvement\nLvl 3: 2 improvements\nLvl 4: >2 improvements",
  23:"Lvl 1: No description\nLvl 2: plausible but incorrect\nLvl 3: 1 lung improvement\nLvl 4: >1 improvement",
  24:"Lvl 1: No explanation\nLvl 2: plausible but incorrect\nLvl 3: accurate reason\nLvl 4: >1 reason",
  25:"Lvl 1: No improvement\nLvl 2: 1 improvement\nLvl 3: 2 improvements\nLvl 4: >2 improvements",
  26:"Lvl 1: No description\nLvl 2: plausible but incorrect\nLvl 3: 1 lung improvement\nLvl 4: >1 improvement",
  27:"Lvl 1: No exercise\nLvl 2: plausible but wrong exercise/intensity\nLvl 3: proper exercise + intensity\nLvl 4: 2+ ways + proper intensity",
  28:"Lvl 1: No description\nLvl 2: incomplete\nLvl 3: accurate both\nLvl 4: accurate + examples",

  // Standard 4 rubrics [29]-[37]  [oai_citation:12‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)
  29:"Lvl 1: No understanding\nLvl 2: partial\nLvl 3: accurate + good understanding\nLvl 4: accurate + apply outside PE/sports",
  30:"Lvl 1: No understanding\nLvl 2: partial\nLvl 3: accurate\nLvl 4: deep understanding",
  31:"Lvl 1: No understanding\nLvl 2: partial\nLvl 3: accurate\nLvl 4: deep understanding",
  32:"Lvl 1: No understanding\nLvl 2: partial\nLvl 3: accurate\nLvl 4: accurate + apply outside PE/sports",
  33:"Lvl 1: No understanding\nLvl 2: partial\nLvl 3: accurate\nLvl 4: accurate + apply outside PE/sports",
  34:"Lvl 1: No understanding\nLvl 2: partial\nLvl 3: accurate\nLvl 4: accurate + apply outside PE/sports",
  35:"Lvl 1: No understanding\nLvl 2: partial\nLvl 3: accurate\nLvl 4: deep understanding",
  36:"Lvl 1: No understanding\nLvl 2: partial\nLvl 3: accurate\nLvl 4: deep understanding",
  37:"Lvl 1: No understanding\nLvl 2: partial\nLvl 3: accurate\nLvl 4: deep understanding",
};

const STANDARD2_QUESTIONS = [
  { id:"s2q1", unit:"Athletic Development", rubric:1,  text:"What are the benefits of using the force platform to track movement data?" },
  { id:"s2q2", unit:"Athletic Development", rubric:2,  text:"Why are the exercises and activities we do in athletic development good for people that don't participate in athletics?" },
  { id:"s2q3", unit:"Ultimate",            rubric:3,  text:"Describe how you would teach someone how to throw a backhand." },
  { id:"s2q4", unit:"Ultimate",            rubric:4,  text:"List a sport(s) that transfer to ultimate and explain what transfers." },
  { id:"s2q5", unit:"Flag Football",       rubric:5,  text:"Explain three of the receiving routes taught during this unit." },
  { id:"s2q6", unit:"Flag Football",       rubric:6,  text:"Describe two different defensive strategies used in football." },
  { id:"s2q7", unit:"Tennis",              rubric:7,  text:"How would you teach someone to hit a forehand?" },
  { id:"s2q8", unit:"Tennis",              rubric:8,  text:"Describe at least two strategies used in tennis (more than two = Level 4)." },
  { id:"s2q9", unit:"Squash",              rubric:9,  text:"If you were to teach someone how to have a successful serve, what would you tell them?" },
  { id:"s2q10",unit:"Squash",              rubric:10, text:"Describe a strategy used in squash." },
  { id:"s2q11",unit:"Volleyball",          rubric:11, text:"How do you increase your chance of making a good forearm pass?" },
  { id:"s2q12",unit:"Volleyball",          rubric:12, text:"Describe the proper technique for setting a ball." },
  { id:"s2q13",unit:"Floor Hockey",        rubric:13, text:"If you were to teach someone how to pass properly, what would you tell them?" },
  { id:"s2q14",unit:"Floor Hockey",        rubric:14, text:"Describe a strategy that would help an offense score in floor hockey." },
  { id:"s2q15",unit:"Wrestling",           rubric:15, text:"Describe the technique for the double leg takedown." },
  { id:"s2q16",unit:"Wrestling",           rubric:16, text:"Describe the proper technique for the switch." },
  { id:"s2q17",unit:"Yoga",                rubric:17, text:"How can you increase the difficulty of a yoga pose?" },
  { id:"s2q18",unit:"Yoga",                rubric:18, text:"Describe proper front-leg alignment in Warrior 2 → Reverse Warrior → Extended Side Angle and why it matters." },
];

const STANDARD3_QUESTIONS = [
  { id:"s3q19", unit:"Athletic Development", rubric:19, text:"What are the benefits of improving strength?" },
  { id:"s3q20", unit:"Athletic Development", rubric:20, text:"List the three energy systems and describe the intensities when each becomes your body's main method for using energy." },
  { id:"s3q21", unit:"Ultimate",            rubric:21, text:"How can playing a fun, active game like ultimate help improve your ability to learn in the classroom?" },
  { id:"s3q22", unit:"Flag Football",       rubric:22, text:"How does proper hydration impact your body when you are playing a sport?" },
  { id:"s3q23", unit:"Tennis",              rubric:23, text:"Describe how exercise improves your lungs." },
  { id:"s3q24", unit:"Squash",              rubric:24, text:"Why does your body need vitamin D and calcium to help make your bones stronger?" },
  { id:"s3q25", unit:"Volleyball",          rubric:25, text:"How can short bursts + rest improve the health and function of blood vessels?" },
  { id:"s3q26", unit:"Floor Hockey",        rubric:26, text:"How does regular aerobic exercise help your lungs become stronger/more efficient?" },
  { id:"s3q27", unit:"Wrestling",           rubric:27, text:"What can a wrestler do to improve their glycolytic (lactic acid) system?" },
  { id:"s3q28", unit:"Yoga",                rubric:28, text:"Describe what happens when parasympathetic and sympathetic systems are stimulated." },
];

const STANDARD4_RATING_PROMPTS = UNITS.map(u => ({
  unit: u,
  studentKey: `s4_${u}_self`,
  teacherKey: `s4_${u}_teacher`,
  prompt: `Rate teamwork/leadership for ${u} (1–4)`
}));

const STANDARD4_QUESTIONS = [
  { id:"s4q29", unit:"Athletic Development", rubric:29, text:"How does hard work impact positive leadership and teamwork?" },
  { id:"s4q30", unit:"Ultimate",            rubric:30, text:"What specific behaviors show good listening on a successful team?" },
  { id:"s4q31", unit:"Flag Football",       rubric:31, text:"Why is showing respect important to leadership and being a good teammate?" },
  { id:"s4q32", unit:"Tennis",              rubric:32, text:"Describe giving/receiving positive feedback and its effect." },
  { id:"s4q33", unit:"Squash",              rubric:33, text:"Why is being respectful important for a positive leader/supportive teammate?" },
  { id:"s4q34", unit:"Volleyball",          rubric:34, text:"Why is it important for team members to know their roles?" },
  { id:"s4q35", unit:"Floor Hockey",        rubric:35, text:"Describe a time you/classmate showed strong focus and its effect." },
  { id:"s4q36", unit:"Wrestling",           rubric:36, text:"Why is a safe/supportive environment important for team/class success?" },
  { id:"s4q37", unit:"Yoga",                rubric:37, text:"What would listening to each other look like on a successful team?" },
];

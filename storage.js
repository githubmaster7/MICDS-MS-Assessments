// storage.js
const KEY = "micds_assessment_v1";

function nowIso(){ return new Date().toISOString(); }

export function loadDB(){
  try{
    const raw = localStorage.getItem(KEY);
    if (!raw) return { students: {}, roster: [] };
    const db = JSON.parse(raw);
    if (!db.students) db.students = {};
    if (!db.roster) db.roster = Object.keys(db.students);
    return db;
  }catch{
    return { students: {}, roster: [] };
  }
}

export function saveDB(db){
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function ensureStudent(email){
  const db = loadDB();
  const e = (email || "").trim().toLowerCase();
  if (!e) throw new Error("Missing email");

  if (!db.students[e]){
    db.students[e] = {
      email: e,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      honorCode: false,
      student: { scores: {}, proofs: {} },
      teacher: { scores: {}, notes: {} },
    };
    if (!db.roster.includes(e)) db.roster.push(e);
    saveDB(db);
  }
  return db.students[e];
}

export function getStudent(email){
  const db = loadDB();
  const e = (email || "").trim().toLowerCase();
  return db.students[e] || null;
}

export function setHonorCode(email, checked){
  const db = loadDB();
  const e = email.trim().toLowerCase();
  if (!db.students[e]) return;
  db.students[e].honorCode = !!checked;
  db.students[e].updatedAt = nowIso();
  saveDB(db);
}

export function updateStudent(email, updaterFn){
  const db = loadDB();
  const e = email.trim().toLowerCase();
  if (!db.students[e]) return null;
  updaterFn(db.students[e]);
  db.students[e].updatedAt = nowIso();
  if (!db.roster.includes(e)) db.roster.push(e);
  saveDB(db);
  return db.students[e];
}

export function listRoster(){
  const db = loadDB();
  return db.roster.slice().sort();
}

export function getAllStudents(){
  const db = loadDB();
  return Object.values(db.students);
}

export function resetStudent(email){
  const db = loadDB();
  const e = email.trim().toLowerCase();
  if (!db.students[e]) return;
  db.students[e].honorCode = false;
  db.students[e].student = { scores: {}, proofs: {} };
  db.students[e].teacher = { scores: {}, notes: {} };
  db.students[e].updatedAt = nowIso();
  saveDB(db);
}

export function exportJSON(){
  const db = loadDB();
  return JSON.stringify(db, null, 2);
}

export function importJSON(jsonText){
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");
  if (!parsed.students) throw new Error("Missing students field");
  if (!parsed.roster) parsed.roster = Object.keys(parsed.students);
  localStorage.setItem(KEY, JSON.stringify(parsed));
}

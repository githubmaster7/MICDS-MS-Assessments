// localStorage-backed "database".
// Data is keyed by student email so teachers can switch students.

const KEY = "micds_assessment_v1";

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
  catch { return {}; }
}
function saveAll(all) {
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getStudent(email) {
  const all = loadAll();
  return all[email] || null;
}
export function setStudent(email, data) {
  const all = loadAll();
  all[email] = data;
  saveAll(all);
}
export function listStudents() {
  const all = loadAll();
  return Object.keys(all).sort();
}

export function exportAll() {
  return loadAll();
}
export function importAll(obj) {
  if (!obj || typeof obj !== "object") throw new Error("Invalid JSON");
  saveAll(obj);
}

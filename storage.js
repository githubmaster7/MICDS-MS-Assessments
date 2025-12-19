const KEY = "micds-assessments";

export function loadAll() {
  return JSON.parse(localStorage.getItem(KEY) || "{}");
}

export function saveAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function emptyStudent() {
  return {
    standards: {
      std1: { student: null, teacher: null },
      std2: { student: null, teacher: null },
      std3: { student: null, teacher: null },
      std4: { student: null, teacher: null }
    }
  };
}

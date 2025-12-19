import { DATA, SCORE_OPTIONS, SCORE_COLOR } from "./data.js";
import * as DB from "./storage.js";

let currentStudent = null;
let state = {};

export function init() {
  bindTabs();
  bindStudentControls();
  renderAll();
  refreshStudentList();
}

function bindTabs() {
  document.querySelectorAll(".tabbtn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tabbtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
      document.getElementById("view-" + btn.dataset.view).classList.remove("hidden");
    };
  });
}

function bindStudentControls() {
  document.getElementById("load-student").onclick = () => {
    const email = document.getElementById("student-email").value.trim();
    if (!email) return alert("Enter student email");
    loadStudent(email);
  };

  document.getElementById("reset-student").onclick = () => {
    if (!currentStudent) return;
    if (!confirm("Reset all data for this student?")) return;
    state = {};
    save();
    renderAll();
  };

  document.getElementById("export-btn").onclick = () => {
    const blob = new Blob([JSON.stringify(DB.exportAll(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "micds_assessment_export.json";
    a.click();
  };

  document.getElementById("import-file").onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      DB.importAll(JSON.parse(reader.result));
      refreshStudentList();
      alert("Import successful");
    };
    reader.readAsText(file);
  };
}

function refreshStudentList() {
  const sel = document.getElementById("student-picker");
  sel.innerHTML = `<option value="">Select student</option>`;
  DB.listStudents().forEach(email => {
    const o = document.createElement("option");
    o.value = email;
    o.textContent = email;
    sel.appendChild(o);
  });
  sel.onchange = () => sel.value && loadStudent(sel.value);
}

function loadStudent(email) {
  currentStudent = email;
  state = DB.getStudent(email) || {};
  renderAll();
}

function save() {
  if (!currentStudent) return;
  DB.setStudent(currentStudent, state);
  refreshStudentList();
}

function renderAll() {
  renderS1();
  renderS2();
  renderS3();
  renderS4();
  renderATL();
  updateOverview();
}

function makeScoreSelect(path) {
  const sel = document.createElement("select");
  sel.className = "scoreSelect";
  SCORE_OPTIONS.forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v || "—";
    sel.appendChild(o);
  });
  sel.value = path in state ? state[path] : "";

  applyScoreColor(sel);

  sel.onchange = () => {
    state[path] = sel.value;
    applyScoreColor(sel);
    save();
    updateOverview();
  };
  return sel;
}

function applyScoreColor(sel) {
  sel.classList.remove("s1", "s2", "s3", "s4");
  if (SCORE_COLOR[sel.value]) sel.classList.add(SCORE_COLOR[sel.value]);
}

function renderS1() {
  const root = document.getElementById("s1-root");
  root.innerHTML = "";
  const table = document.createElement("table");
  table.className = "sheet";

  table.innerHTML = `
    <thead><tr>
      <th>Skill</th>
      <th>Score</th>
    </tr></thead>
  `;
  const tb = document.createElement("tbody");

  DATA.standards.s1.rows.forEach((label, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${label}</td>`;
    const td = document.createElement("td");
    td.appendChild(makeScoreSelect(`s1_${i}`));
    tr.appendChild(td);
    tb.appendChild(tr);
  });

  table.appendChild(tb);
  root.appendChild(table);
}

function renderQuestions(rootId, prefix, questions) {
  const root = document.getElementById(rootId);
  root.innerHTML = "";
  questions.forEach((q, i) => {
    const card = document.createElement("div");
    card.className = "sheetCard";
    card.innerHTML = `<div class="sheetTitle">${q}</div>`;

    const score = makeScoreSelect(`${prefix}_score_${i}`);
    const ans = document.createElement("textarea");
    ans.className = "answer";
    ans.value = state[`${prefix}_ans_${i}`] || "";
    ans.oninput = () => {
      state[`${prefix}_ans_${i}`] = ans.value;
      save();
    };

    card.appendChild(score);
    card.appendChild(ans);
    root.appendChild(card);
  });
}

function renderS2() {
  renderQuestions("s2-root", "s2", DATA.standards.s2.questions);
}
function renderS3() {
  renderQuestions("s3-root", "s3", DATA.standards.s3.questions);
}

function renderS4() {
  const rRoot = document.getElementById("s4-ratings");
  rRoot.innerHTML = "";
  renderQuestions("s4-questions", "s4q", DATA.standards.s4.questions);

  const table = document.createElement("table");
  table.className = "sheet";
  table.innerHTML = `<thead><tr><th>Rating</th><th>Score</th></tr></thead>`;
  const tb = document.createElement("tbody");

  DATA.standards.s4.ratings.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r}</td>`;
    const td = document.createElement("td");
    td.appendChild(makeScoreSelect(`s4r_${i}`));
    tr.appendChild(td);
    tb.appendChild(tr);
  });

  table.appendChild(tb);
  rRoot.appendChild(table);
}

function renderATL() {
  const root = document.getElementById("atl-effort");
  root.innerHTML = "";
  DATA.standards.atl.effort.forEach((label, i) => {
    const card = document.createElement("div");
    card.className = "sheetCard";
    card.innerHTML = `<div class="sheetTitle">${label}</div>`;
    card.appendChild(makeScoreSelect(`atl_${i}`));
    root.appendChild(card);
  });

  const late = document.getElementById("atl-late-count");
  late.oninput = () => {
    const n = parseInt(late.value || "0", 10);
    state.atl_late = n;
    save();
    updateOverview();
  };
}

function avg(keys) {
  const vals = keys.map(k => parseInt(state[k], 10)).filter(v => !isNaN(v));
  if (!vals.length) return null;
  return (vals.reduce((a,b)=>a+b,0) / vals.length).toFixed(2);
}

function updateOverview() {
  const s1 = avg(DATA.standards.s1.rows.map((_,i)=>`s1_${i}`));
  const s2 = avg(DATA.standards.s2.questions.map((_,i)=>`s2_score_${i}`));
  const s3 = avg(DATA.standards.s3.questions.map((_,i)=>`s3_score_${i}`));
  const s4 = avg([
    ...DATA.standards.s4.ratings.map((_,i)=>`s4r_${i}`),
    ...DATA.standards.s4.questions.map((_,i)=>`s4q_score_${i}`)
  ]);

  setText("s1-grade", s1);
  setText("s2-grade", s2);
  setText("s3-grade", s3);
  setText("s4-grade", s4);

  const finals = [s1,s2,s3,s4].map(Number).filter(n=>!isNaN(n));
  setText("final-grade", finals.length ? (finals.reduce((a,b)=>a+b,0)/finals.length).toFixed(2) : "—");

  const late = state.atl_late || 0;
  const atl = late===0?4:late<=3?3:late<=6?2:1;
  setText("atl-score", atl);
}

function setText(id, v) {
  document.getElementById(id).textContent = v ?? "—";
}

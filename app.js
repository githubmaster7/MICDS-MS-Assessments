// app.js
import { TABS, RUBRIC, SCORE_LEVELS, scoreBadgeClass,
         computeOverallGrade, computeStandardAverage,
         atlScoreFromLateCount, computePopulationCounts } from "./data.js";
import { ensureStudent, getStudent, updateStudent, listRoster, getAllStudents,
         setHonorCode, resetStudent, exportJSON, importJSON } from "./storage.js";
import { drawDonutCounts } from "./charts.js";

let state = {
  activeTab: "scores",
  email: "",
  isTeacher: false,
};

function $(id){ return document.getElementById(id); }

function setStatus(msg){
  $("status").textContent = msg || "";
}

function makeEl(tag, attrs={}, children=[]){
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs)){
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of children){
    if (c === null || c === undefined) continue;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

function scoreSelect(value, onChange){
  const sel = makeEl("select", { class: "selectScore" });
  sel.appendChild(new Option("—", ""));
  for (const n of SCORE_LEVELS){
    sel.appendChild(new Option(String(n), String(n)));
  }
  sel.value = (value ?? "") === null ? "" : String(value ?? "");
  sel.addEventListener("change", () => onChange(sel.value === "" ? null : Number(sel.value)));
  return sel;
}

function badge(n){
  if (!n) return makeEl("span", { class:"badge" }, ["—"]);
  return makeEl("span", { class:`badge ${scoreBadgeClass(n)}` }, [`${n}`]);
}

function refreshRosterUI(){
  const roster = listRoster();
  const select = $("studentSelect");
  select.innerHTML = "";
  select.appendChild(new Option("Select student", ""));
  for (const e of roster){
    select.appendChild(new Option(e, e));
  }
  if (state.email) select.value = state.email;
}

function buildTabs(){
  const tabs = $("tabs");
  tabs.innerHTML = "";
  for (const t of TABS){
    const el = makeEl("button", {
      class: `tab ${state.activeTab === t.id ? "active" : ""}`,
      onclick: () => { state.activeTab = t.id; render(); }
    }, [t.label]);
    tabs.appendChild(el);
  }
}

function loadOrCreate(){
  const email = ($("studentEmail").value || $("studentSelect").value || "").trim().toLowerCase();
  if (!email){
    setStatus("Enter/select a student email first.");
    return;
  }
  ensureStudent(email);
  state.email = email;
  $("studentEmail").value = email;
  refreshRosterUI();
  setStatus(`Loaded: ${email} • Mode: ${state.isTeacher ? "Teacher" : "Student"}`);
  render();
}

function handleExport(){
  const blob = new Blob([exportJSON()], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "micds-assessment-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

function handleImport(){
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    importJSON(text);
    refreshRosterUI();
    setStatus("Imported JSON successfully.");
    render();
  };
  input.click();
}

function initTopbar(){
  $("btnLoadCreate").addEventListener("click", loadOrCreate);

  $("studentSelect").addEventListener("change", () => {
    const v = $("studentSelect").value;
    if (v){
      $("studentEmail").value = v;
      state.email = v;
      render();
    }
  });

  $("teacherToggle").addEventListener("change", (e) => {
    state.isTeacher = e.target.checked;
    setStatus(`Mode: ${state.isTeacher ? "Teacher" : "Student"}`);
    render();
  });

  $("honorCode").addEventListener("change", (e) => {
    if (!state.email) return;
    setHonorCode(state.email, e.target.checked);
    render();
  });

  $("btnResetStudent").addEventListener("click", () => {
    if (!state.email) return;
    resetStudent(state.email);
    setStatus(`Reset: ${state.email}`);
    render();
  });

  $("btnExport").addEventListener("click", handleExport);
  $("btnImport").addEventListener("click", handleImport);
}

function renderScoresAndGrades(record){
  const overall = computeOverallGrade(record);
  const s1 = computeStandardAverage(RUBRIC.s1, record);
  const s2 = computeStandardAverage(RUBRIC.s2, record);
  const s3 = computeStandardAverage(RUBRIC.s3, record);
  const s4 = computeStandardAverage(RUBRIC.s4, record);

  const allStudents = getAllStudents();
  const keysAll = [
    ...RUBRIC.s1.map(x=>x.key),
    ...RUBRIC.s2.map(x=>x.key),
    ...RUBRIC.s3.map(x=>x.key),
    ...RUBRIC.s4.map(x=>x.key),
  ];
  const popCounts = computePopulationCounts(allStudents, keysAll);

  const left = makeEl("div", { class:"card" }, [
    makeEl("div", { class:"sectionTitle" }, ["Overview"]),
    makeEl("div", { class:"kpiRow" }, [
      makeEl("div", { class:"kpi" }, [
        makeEl("div", { class:"label" }, ["CURRENT GRADE"]),
        makeEl("div", { class:"bigNumber" }, [overall === null ? "—" : overall.toFixed(2)]),
        makeEl("div", { class:"muted" }, ["Average of Standards 1–4 (25% each) • Teacher overrides Student"])
      ]),
      makeEl("div", { class:"kpi" }, [
        makeEl("div", { class:"label" }, ["Honor Code"]),
        makeEl("div", { class:"value" }, [record?.honorCode ? "✓" : "—"]),
        makeEl("div", { class:"muted" }, ["Students should check before submitting."])
      ])
    ]),
    makeEl("div", { class:"kpiRow", style:"margin-top:12px;" }, [
      makeEl("div", { class:"kpi" }, [
        makeEl("div", { class:"label" }, ["Standard 1"]),
        makeEl("div", { class:"value" }, [s1 === null ? "—" : s1.toFixed(2)])
      ]),
      makeEl("div", { class:"kpi" }, [
        makeEl("div", { class:"label" }, ["Standard 2"]),
        makeEl("div", { class:"value" }, [s2 === null ? "—" : s2.toFixed(2)])
      ]),
      makeEl("div", { class:"kpi" }, [
        makeEl("div", { class:"label" }, ["Standard 3"]),
        makeEl("div", { class:"value" }, [s3 === null ? "—" : s3.toFixed(2)])
      ]),
      makeEl("div", { class:"kpi" }, [
        makeEl("div", { class:"label" }, ["Standard 4"]),
        makeEl("div", { class:"value" }, [s4 === null ? "—" : s4.toFixed(2)])
      ]),
    ])
  ]);

  const right = makeEl("div", { class:"card" }, [
    makeEl("div", { class:"sectionTitle" }, [state.isTeacher ? "Teacher Dashboard (Population)" : "Class Snapshot (Read-only)"]),
    makeEl("div", { class:"muted" }, [
      state.isTeacher
        ? "Counts use effective scores (Teacher overrides Student)."
        : "Ask teacher to toggle Teacher View for full dashboard."
    ]),
    makeEl("div", { class:"canvasWrap", style:"margin-top:10px;" }, [
      (() => {
        const c = document.createElement("canvas");
        c.width = 420; c.height = 260;
        drawDonutCounts(c, popCounts, "Population score distribution (All Standards)");
        return c;
      })()
    ]),
  ]);

  return makeEl("div", { class:"grid2" }, [left, right]);
}

function renderStandardTable(stdId, record){
  const items = RUBRIC[stdId];

  const table = makeEl("table", { class:"table" });
  const thead = makeEl("thead");
  thead.appendChild(makeEl("tr", {}, [
    makeEl("th", {}, ["Unit"]),
    makeEl("th", {}, ["Concept"]),
    makeEl("th", {}, ["Student Score"]),
    makeEl("th", {}, ["Teacher Score (Overrides)"]),
    makeEl("th", {}, ["Proof / Notes"])
  ]));
  table.appendChild(thead);

  const tbody = makeEl("tbody");
  for (const it of items){
    const studentVal = record?.student?.scores?.[it.key] ?? null;
    const teacherVal = record?.teacher?.scores?.[it.key] ?? null;

    const studentCell = makeEl("div", { class:"cellStack" }, [
      badge(studentVal),
      scoreSelect(studentVal, (v) => {
        if (!state.email) return;
        updateStudent(state.email, (r) => { r.student.scores[it.key] = v; });
        render();
      })
    ]);

    const teacherCell = makeEl("div", { class:"cellStack" }, [
      badge(teacherVal),
      scoreSelect(teacherVal, (v) => {
        if (!state.email) return;
        updateStudent(state.email, (r) => { r.teacher.scores[it.key] = v; });
        render();
      })
    ]);

    // Student proof + teacher note shown to both.
    const studentProof = record?.student?.proofs?.[it.key] ?? "";
    const teacherNote = record?.teacher?.notes?.[it.key] ?? "";

    const proofWrap = makeEl("div", { class:"cellStack" }, [
      makeEl("div", { class:"muted" }, ["Student proof:"]),
      (() => {
        const ta = makeEl("textarea", { class:"textarea", placeholder:"Student proof / explanation..." });
        ta.value = studentProof;
        ta.disabled = state.isTeacher; // teacher view: don’t edit student proof
        ta.addEventListener("input", () => {
          if (!state.email) return;
          updateStudent(state.email, (r) => { r.student.proofs[it.key] = ta.value; });
        });
        return ta;
      })(),
      makeEl("div", { class:"muted" }, ["Teacher note:"]),
      (() => {
        const ta = makeEl("textarea", { class:"textarea", placeholder:"Teacher feedback / note..." });
        ta.value = teacherNote;
        ta.disabled = !state.isTeacher; // student view: don’t edit teacher notes
        ta.addEventListener("input", () => {
          if (!state.email) return;
          updateStudent(state.email, (r) => { r.teacher.notes[it.key] = ta.value; });
        });
        return ta;
      })(),
    ]);

    // If ATL number row:
    if (it.type === "number"){
      const atlVal = record?.student?.scores?.[it.key] ?? 0;
      const atlScore = atlScoreFromLateCount(atlVal);

      const input = makeEl("input", { class:"control", type:"number", min: it.min ?? 0, max: it.max ?? 99, value: String(atlVal) });
      input.style.minWidth = "120px";
      input.disabled = state.isTeacher; // student fills
      input.addEventListener("input", () => {
        if (!state.email) return;
        updateStudent(state.email, (r) => { r.student.scores[it.key] = Number(input.value || 0); });
        render();
      });

      const row = makeEl("tr", {}, [
        makeEl("td", {}, [it.unit]),
        makeEl("td", {}, [
          makeEl("div", { style:"font-weight:800;" }, [it.concept]),
          makeEl("div", { class:"muted" }, ["0 → 4, 1–3 → 3, 4–6 → 2, >6 → 1"])
        ]),
        makeEl("td", {}, [input]),
        makeEl("td", {}, [
          makeEl("div", { class:`badge ${scoreBadgeClass(atlScore)}` }, [`ATL Score: ${atlScore}`]),
          makeEl("div", { class:"muted", style:"margin-top:6px;" }, ["(Computed from student input)"])
        ]),
        makeEl("td", {}, [makeEl("div", { class:"muted" }, ["N/A"])])
      ]);
      tbody.appendChild(row);
      continue;
    }

    const row = makeEl("tr", {}, [
      makeEl("td", {}, [it.unit]),
      makeEl("td", {}, [it.concept]),
      makeEl("td", {}, [studentCell]),
      makeEl("td", {}, [teacherCell]),
      makeEl("td", {}, [proofWrap]),
    ]);

    tbody.appendChild(row);
  }

  table.appendChild(tbody);

  // Teacher: add a mini chart for this standard across population
  let chartBlock = null;
  if (state.isTeacher && ["s1","s2","s3","s4"].includes(stdId)){
    const all = getAllStudents();
    const keys = RUBRIC[stdId].map(x=>x.key);
    const counts = computePopulationCounts(all, keys);

    const canvas = document.createElement("canvas");
    canvas.width = 420; canvas.height = 260;
    drawDonutCounts(canvas, counts, `Population distribution: ${stdId.toUpperCase()}`);

    chartBlock = makeEl("div", { class:"card", style:"margin-top:14px;" }, [
      makeEl("div", { class:"sectionTitle" }, ["Teacher: Class Chart"]),
      makeEl("div", { class:"muted" }, ["Effective scores across all students (teacher overrides)."]),
      makeEl("div", { style:"margin-top:10px;" }, [canvas])
    ]);
  }

  return makeEl("div", {}, [
    makeEl("div", { class:"sectionTitle" }, [tabLabel(stdId)]),
    makeEl("div", { class:"muted", style:"margin-bottom:10px;" }, [
      state.isTeacher
        ? "Teacher mode: you can enter teacher scores/notes; teacher score overrides for grade/charts."
        : "Student mode: enter your self score + proof; you can still see teacher scores once added."
    ]),
    table,
    chartBlock
  ]);
}

function tabLabel(id){
  return (TABS.find(t=>t.id===id)?.label) || id;
}

function render(){
  buildTabs();
  refreshRosterUI();

  const view = $("view");
  view.innerHTML = "";

  // Update honor code checkbox from record
  const record = state.email ? getStudent(state.email) : null;
  $("honorCode").checked = !!record?.honorCode;

  if (!state.email){
    view.appendChild(makeEl("div", { class:"card" }, [
      makeEl("div", { class:"sectionTitle" }, ["Start"]),
      makeEl("div", { class:"muted" }, ["Select a student or type an email, then click Load / Create."]),
    ]));
    return;
  }

  if (state.activeTab === "scores"){
    view.appendChild(renderScoresAndGrades(record));
    return;
  }

  if (["s1","s2","s3","s4","atl"].includes(state.activeTab)){
    view.appendChild(renderStandardTable(state.activeTab, record));
    return;
  }

  view.appendChild(makeEl("div", { class:"card" }, [
    makeEl("div", { class:"sectionTitle" }, ["Unknown tab"]),
    makeEl("div", { class:"muted" }, ["This tab wasn’t recognized."])
  ]));
}

export function initApp(){
  initTopbar();
  refreshRosterUI();
  buildTabs();
  render();
}

let CURRENT = {
  viewerEmail: null,     // logged-in user
  role: "Student",       // Student | Teacher
  targetEmail: null,     // whose record we are viewing/editing
  record: null
};

function emptyRecord(email){
  return {
    email,
    honorCode: false,
    updatedAt: Date.now(),
    // Standard 1 skill ratings 1-4
    s1Skills: Object.fromEntries(S1_SKILLS.map(s => [s, ""])),
    // Qs: { score, answer, reassess }
    s2: Object.fromEntries(STANDARD2_QUESTIONS.map(q => [q.id, {score:"", answer:"", reassess:""}])),
    s3: Object.fromEntries(STANDARD3_QUESTIONS.map(q => [q.id, {score:"", answer:"", reassess:""}])),
    s4q: Object.fromEntries(STANDARD4_QUESTIONS.map(q => [q.id, {score:"", answer:"", reassess:""}])),
    s4ratings: Object.fromEntries(UNITS.map(u => [u, {self:"", teacher:""}])),
    atl: { lateCount: 0, effort: Object.fromEntries(UNITS.map(u => [u, {student:"", teacher:""}])) }
  };
}

function fmt(n){
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function navInit(){
  document.querySelectorAll(".navbtn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".navbtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const v = btn.dataset.view;
      document.querySelectorAll(".view").forEach(s => s.classList.add("hidden"));
      document.getElementById(`view-${v}`).classList.remove("hidden");
    });
  });
}

function roleCanEditTeacher(){
  return CURRENT.role === "Teacher";
}
function roleCanEditStudent(){
  return true; // Students can edit their stuff; teachers can also fill student answers if needed
}
function isStudentViewOther(){
  return CURRENT.role !== "Teacher" && CURRENT.targetEmail !== CURRENT.viewerEmail;
}

function ratingPill(score){
  if (!score) return "";
  const s = Number(score);
  if (s >= 3) return `<span class="pilltag pill-ok">Level ${s}</span>`;
  return `<span class="pilltag pill-warn">Level ${s}</span>`;
}

// --------- scoring rules (green/bright-green/red logic from sheet)  [oai_citation:13‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)
function countsFromRatings(ratings){
  // ratings: array of 1-4 strings
  let red=0, green=0, bright=0, total=0;
  for (const r of ratings){
    if (!r) continue;
    total++;
    const n = Number(r);
    if (n <= 1) red++;
    if (n >= 3) green++;
    if (n >= 4) bright++;
  }
  const greenPct = total ? (green/total)*100 : 0;
  const brightPct = total ? (bright/total)*100 : 0;
  return {red, green, bright, total, greenPct, brightPct};
}

// Standard 1 conversion (sheet): depends on “everything green”, “bright green fraction”, red counts, etc.  [oai_citation:14‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)
function std1Convert(stats){
  const {red, total, greenPct, brightPct} = stats;
  if (total === 0) return null;
  // interpret "everything green" as greenPct == 100 and red==0
  if (greenPct === 100 && red === 0){
    if (brightPct > 50) return 4;
    return 3.5;
  }
  if (greenPct > 50 && red === 0) return 3;
  if (greenPct >= 40 && greenPct <= 49 && red === 0) return 2.5;
  if ((greenPct >= 30 && greenPct <= 39) || (red >= 1 && red <= 3)) return 2;
  if ((greenPct >= 20 && greenPct <= 29) || (red >= 4 && red <= 6)) return 1.5;
  return 1;
}

// Standard 2/3/4 conversion (sheet):  [oai_citation:15‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)
function std234Convert(stats){
  const {red, total, greenPct, brightPct} = stats;
  if (total === 0) return null;

  if (greenPct === 100 && red === 0){
    // Std2 says quarter bright green for 3.5, Std3/4 same general
    // We'll use: if brightPct > 50 => 4 else if brightPct >= 25 => 3.5 else 3.5 (still all green)
    if (brightPct > 50) return 4;
    return 3.5;
  }

  if (greenPct >= 80 && red === 0) return 3;
  if (greenPct >= 70 && greenPct <= 79 && red === 0) return 2.5;
  if ((greenPct >= 50 && greenPct <= 69) || (red >= 1 && red <= 3)) return 2;
  if ((greenPct >= 25 && greenPct <= 49) || (red >= 4 && red <= 5)) return 1.5;
  return 1;
}

function computeStd1(rec){
  const ratings = Object.values(rec.s1Skills);
  return std1Convert(countsFromRatings(ratings));
}
function computeStd2(rec){
  const ratings = Object.values(rec.s2).map(x => x.score);
  return std234Convert(countsFromRatings(ratings));
}
function computeStd3(rec){
  const ratings = Object.values(rec.s3).map(x => x.score);
  return std234Convert(countsFromRatings(ratings));
}
function computeStd4(rec){
  // combine: question scores + both self+teacher ratings (if present)
  const qScores = Object.values(rec.s4q).map(x => x.score);
  const ratingScores = [];
  for (const u of UNITS){
    const r = rec.s4ratings[u];
    if (r?.self) ratingScores.push(r.self);
    if (r?.teacher) ratingScores.push(r.teacher);
  }
  const combined = [...qScores, ...ratingScores];
  return std234Convert(countsFromRatings(combined));
}
function computeFinal(rec){
  const s1 = computeStd1(rec);
  const s2 = computeStd2(rec);
  const s3 = computeStd3(rec);
  const s4 = computeStd4(rec);
  const arr = [s1,s2,s3,s4].filter(v => v !== null);
  if (arr.length !== 4) return null;
  return (s1+s2+s3+s4)/4;
}

// --------- persistence
async function loadRecord(email){
  const key = `student:${email}`;
  let rec = await dbGet(key);
  if (!rec) {
    rec = emptyRecord(email);
    await dbSet(key, rec);
  }
  return rec;
}
async function saveCurrent(){
  if (!CURRENT.record) return;
  CURRENT.record.updatedAt = Date.now();
  await dbSet(`student:${CURRENT.targetEmail}`, CURRENT.record);
}

// --------- renderers
function renderOverview(){
  const rec = CURRENT.record;
  const s1 = computeStd1(rec), s2 = computeStd2(rec), s3 = computeStd3(rec), s4 = computeStd4(rec), fin = computeFinal(rec);
  document.getElementById("s1-grade").textContent = fmt(s1);
  document.getElementById("s2-grade").textContent = fmt(s2);
  document.getElementById("s3-grade").textContent = fmt(s3);
  document.getElementById("s4-grade").textContent = fmt(s4);
  document.getElementById("final-grade").textContent = fmt(fin);

  const hc = document.getElementById("honor-code");
  hc.checked = !!rec.honorCode;
  hc.disabled = isStudentViewOther();
  hc.onchange = async () => { rec.honorCode = hc.checked; await saveCurrent(); renderOverview(); };
}

function renderS1(){
  const el = document.getElementById("s1-skill-table");
  const rec = CURRENT.record;

  const rows = S1_SKILLS.map(skill => {
    const v = rec.s1Skills[skill] || "";
    const disabled = isStudentViewOther(); // students can edit their own; teachers can edit too
    return `
      <div class="q">
        <div class="qhead">
          <div style="font-weight:800">${skill}</div>
          <div>${ratingPill(v)}</div>
        </div>
        <div class="scoreline">
          <div class="muted small">Rate 1–4</div>
          <select data-s1="${escapeHtml(skill)}" ${disabled ? "disabled":""}>
            <option value="">Select</option>
            <option ${v==="1"?"selected":""}>1</option>
            <option ${v==="2"?"selected":""}>2</option>
            <option ${v==="3"?"selected":""}>3</option>
            <option ${v==="4"?"selected":""}>4</option>
          </select>
        </div>
      </div>
    `;
  }).join("");

  const stats = countsFromRatings(Object.values(rec.s1Skills));
  const conv = computeStd1(rec);

  el.innerHTML = `
    <div class="row">
      <div class="kpi-mini"><div class="muted">Green%</div><div class="big2">${stats.total?Math.round(stats.greenPct):0}%</div></div>
      <div class="kpi-mini"><div class="muted">Bright green%</div><div class="big2">${stats.total?Math.round(stats.brightPct):0}%</div></div>
      <div class="kpi-mini"><div class="muted">Red count</div><div class="big2">${stats.red}</div></div>
      <div class="kpi-mini"><div class="muted">Standard 1 Score</div><div class="big2">${fmt(conv)}</div></div>
    </div>
    <div style="margin-top:10px">${rows}</div>
  `;

  el.querySelectorAll("select[data-s1]").forEach(sel => {
    sel.addEventListener("change", async () => {
      const skill = unescapeHtml(sel.dataset.s1);
      rec.s1Skills[skill] = sel.value;
      await saveCurrent();
      renderAll();
    });
  });
}

function qBlock(q, bucket){
  // bucket: "s2" | "s3" | "s4q"
  const rec = CURRENT.record;
  const item = rec[bucket][q.id];
  const score = item.score || "";
  const answer = item.answer || "";
  const reassess = item.reassess || "";
  const rubricText = RUBRICS[q.rubric] || "No rubric text found";

  const canTeacherEdit = roleCanEditTeacher();
  const canStudentEdit = !isStudentViewOther(); // if student is viewing someone else (blocked)
  const scoreDisabled = !canTeacherEdit;         // teacher sets score
  const answerDisabled = !canStudentEdit;        // student answers
  const showReassess = score === "1" || score === "2";
  const reassessDisabled = !canStudentEdit;

  return `
    <div class="q">
      <div class="qhead">
        <div class="badge">[${q.rubric}]
          <div class="tip"><pre class="small" style="white-space:pre-wrap;margin:0">${escapeHtml(rubricText)}</pre></div>
        </div>
        <div style="flex:1;min-width:240px">
          <div style="font-weight:800">${escapeHtml(q.unit)} — ${escapeHtml(q.text)}</div>
          <div class="muted small">Score is teacher-set. Reassessment unlocks only for Level 1–2.  [oai_citation:16‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)</div>
        </div>
        <div>${ratingPill(score)}</div>
      </div>

      <div class="scoreline" style="margin-top:10px">
        <div>
          <label class="label">Answer (student)</label>
          <textarea data-q-ans="${q.id}" data-b="${bucket}" ${answerDisabled ? "disabled":""} placeholder="Type answer or paste a video link...">${escapeHtml(answer)}</textarea>
        </div>
        <div>
          <label class="label">Teacher Score</label>
          <select data-q-score="${q.id}" data-b="${bucket}" ${scoreDisabled ? "disabled":""}>
            <option value="">Select</option>
            <option ${score==="1"?"selected":""}>1</option>
            <option ${score==="2"?"selected":""}>2</option>
            <option ${score==="3"?"selected":""}>3</option>
            <option ${score==="4"?"selected":""}>4</option>
          </select>
        </div>
      </div>

      ${showReassess ? `
        <div style="margin-top:10px">
          <label class="label">Reassessment Answer (unlocked because score is ${score})</label>
          <textarea data-q-re="${q.id}" data-b="${bucket}" ${reassessDisabled ? "disabled":""}
            placeholder="PUT YOUR REASSESSMENT ANSWER HERE --------->">${escapeHtml(reassess)}</textarea>
        </div>
      ` : ""}
    </div>
  `;
}

function renderQuestions(containerId, questions, bucket, stdComputeFn){
  const el = document.getElementById(containerId);
  const rec = CURRENT.record;
  const scores = Object.values(rec[bucket]).map(x => x.score);
  const stats = countsFromRatings(scores);
  const conv = stdComputeFn(rec);

  el.innerHTML = `
    <div class="row">
      <div class="kpi-mini"><div class="muted">Green%</div><div class="big2">${stats.total?Math.round(stats.greenPct):0}%</div></div>
      <div class="kpi-mini"><div class="muted">Bright green%</div><div class="big2">${stats.total?Math.round(stats.brightPct):0}%</div></div>
      <div class="kpi-mini"><div class="muted">Red count</div><div class="big2">${stats.red}</div></div>
      <div class="kpi-mini"><div class="muted">Standard Score</div><div class="big2">${fmt(conv)}</div></div>
    </div>
    <div style="margin-top:10px">
      ${questions.map(q => qBlock(q, bucket)).join("")}
    </div>
  `;

  // bind
  el.querySelectorAll("select[data-q-score]").forEach(sel => {
    sel.addEventListener("change", async () => {
      const id = sel.dataset.qScore;
      const b = sel.dataset.b;
      rec[b][id].score = sel.value;
      await saveCurrent();
      renderAll();
    });
  });
  el.querySelectorAll("textarea[data-q-ans]").forEach(t => {
    t.addEventListener("input", async () => {
      const id = t.dataset.qAns;
      const b = t.dataset.b;
      rec[b][id].answer = t.value;
      await saveCurrent();
    });
  });
  el.querySelectorAll("textarea[data-q-re]").forEach(t => {
    t.addEventListener("input", async () => {
      const id = t.dataset.qRe;
      const b = t.dataset.b;
      rec[b][id].reassess = t.value;
      await saveCurrent();
    });
  });
}

function renderS4Ratings(){
  const el = document.getElementById("s4-ratings");
  const rec = CURRENT.record;

  const canTeacher = roleCanEditTeacher();
  const canStudent = !isStudentViewOther();

  el.innerHTML = `
    <div class="muted small">Self-rating is student-set. Teacher rating is teacher-set.  [oai_citation:17‡Example%20middle%20school%20assessment%20sheet.pdf.pdf](sediment://file_00000000808471f5a9b08afe30fcedb7)</div>
    <div style="margin-top:10px">
      ${UNITS.map(u => {
        const self = rec.s4ratings[u]?.self || "";
        const teacher = rec.s4ratings[u]?.teacher || "";
        return `
          <div class="q">
            <div style="font-weight:800">${escapeHtml(u)}</div>
            <div class="row" style="margin-top:8px">
              <div class="field">
                <label class="label">Student Score (1–4)</label>
                <select data-s4-self="${escapeHtml(u)}" ${canStudent ? "" : "disabled"}>
                  <option value="">Select</option>
                  <option ${self==="1"?"selected":""}>1</option>
                  <option ${self==="2"?"selected":""}>2</option>
                  <option ${self==="3"?"selected":""}>3</option>
                  <option ${self==="4"?"selected":""}>4</option>
                </select>
              </div>
              <div class="field">
                <label class="label">Teacher Score (1–4)</label>
                <select data-s4-teacher="${escapeHtml(u)}" ${canTeacher ? "" : "disabled"}>
                  <option value="">Select</option>
                  <option ${teacher==="1"?"selected":""}>1</option>
                  <option ${teacher==="2"?"selected":""}>2</option>
                  <option ${teacher==="3"?"selected":""}>3</option>
                  <option ${teacher==="4"?"selected":""}>4</option>
                </select>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  el.querySelectorAll("select[data-s4-self]").forEach(sel => {
    sel.addEventListener("change", async () => {
      const unit = unescapeHtml(sel.dataset.s4Self);
      rec.s4ratings[unit].self = sel.value;
      await saveCurrent();
      renderAll();
    });
  });
  el.querySelectorAll("select[data-s4-teacher]").forEach(sel => {
    sel.addEventListener("change", async () => {
      const unit = unescapeHtml(sel.dataset.s4Teacher);
      rec.s4ratings[unit].teacher = sel.value;
      await saveCurrent();
      renderAll();
    });
  });
}

function renderATL(){
  const rec = CURRENT.record;
  const lateInput = document.getElementById("atl-late-count");
  lateInput.disabled = isStudentViewOther();
  lateInput.value = rec.atl.lateCount ?? 0;

  const late = Number(lateInput.value || 0);
  let atlScore = 4;
  if (late === 0) atlScore = 4;
  else if (late >= 1 && late <= 3) atlScore = 3;
  else if (late >= 4 && late <= 6) atlScore = 2;
  else atlScore = 1;

  document.getElementById("atl-score").textContent = atlScore;

  lateInput.oninput = async () => {
    rec.atl.lateCount = Number(lateInput.value || 0);
    await saveCurrent();
    renderATL();
  };

  const effortEl = document.getElementById("atl-effort");
  const canTeacher = roleCanEditTeacher();
  const canStudent = !isStudentViewOther();

  effortEl.innerHTML = `
    ${UNITS.map(u => {
      const s = rec.atl.effort[u]?.student || "";
      const t = rec.atl.effort[u]?.teacher || "";
      return `
        <div class="q">
          <div style="font-weight:800">${escapeHtml(u)}</div>
          <div class="row" style="margin-top:8px">
            <div class="field">
              <label class="label">Student Score</label>
              <select data-atl-student="${escapeHtml(u)}" ${canStudent ? "" : "disabled"}>
                <option value="">Select</option>
                <option ${s==="1"?"selected":""}>1</option>
                <option ${s==="2"?"selected":""}>2</option>
                <option ${s==="3"?"selected":""}>3</option>
                <option ${s==="4"?"selected":""}>4</option>
              </select>
            </div>
            <div class="field">
              <label class="label">Teacher Score</label>
              <select data-atl-teacher="${escapeHtml(u)}" ${canTeacher ? "" : "disabled"}>
                <option value="">Select</option>
                <option ${t==="1"?"selected":""}>1</option>
                <option ${t==="2"?"selected":""}>2</option>
                <option ${t==="3"?"selected":""}>3</option>
                <option ${t==="4"?"selected":""}>4</option>
              </select>
            </div>
          </div>
        </div>
      `;
    }).join("")}
  `;

  effortEl.querySelectorAll("select[data-atl-student]").forEach(sel => {
    sel.addEventListener("change", async () => {
      const unit = unescapeHtml(sel.dataset.atlStudent);
      rec.atl.effort[unit].student = sel.value;
      await saveCurrent();
    });
  });
  effortEl.querySelectorAll("select[data-atl-teacher]").forEach(sel => {
    sel.addEventListener("change", async () => {
      const unit = unescapeHtml(sel.dataset.atlTeacher);
      rec.atl.effort[unit].teacher = sel.value;
      await saveCurrent();
    });
  });
}

function renderAll(){
  renderOverview();
  renderS1();
  renderQuestions("s2-questions", STANDARD2_QUESTIONS, "s2", computeStd2);
  renderQuestions("s3-questions", STANDARD3_QUESTIONS, "s3", computeStd3);
  renderS4Ratings();
  renderQuestions("s4-questions", STANDARD4_QUESTIONS, "s4q", computeStd4);
  renderATL();
}

function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
function unescapeHtml(s){
  return String(s).replaceAll("&quot;",'"').replaceAll("&gt;",">").replaceAll("&lt;","<").replaceAll("&amp;","&");
}

async function exportAll(){
  // Teacher: export all students; Student: export self
  const keys = await dbKeys();
  const data = {};
  if (CURRENT.role === "Teacher"){
    for (const k of keys){
      if (String(k).startsWith("student:")){
        data[k] = await dbGet(k);
      }
    }
  } else {
    data[`student:${CURRENT.viewerEmail}`] = await dbGet(`student:${CURRENT.viewerEmail}`);
  }
  const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), data }, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `micds_assessment_export_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importAll(file){
  const text = await file.text();
  const parsed = JSON.parse(text);
  const data = parsed.data || {};
  for (const k of Object.keys(data)){
    await dbSet(k, data[k]);
  }
  await teacherRefreshStudentList();
  await selectTarget(CURRENT.targetEmail || CURRENT.viewerEmail);
}

async function teacherRefreshStudentList(){
  if (CURRENT.role !== "Teacher") return;
  const sel = document.getElementById("teacher-student-select");
  const keys = await dbKeys();
  const emails = keys
    .filter(k => String(k).startsWith("student:"))
    .map(k => String(k).slice("student:".length))
    .sort((a,b)=>a.localeCompare(b));

  sel.innerHTML = emails.length
    ? emails.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("")
    : `<option value="">(no students yet)</option>`;

  if (!emails.includes(CURRENT.targetEmail)) {
    CURRENT.targetEmail = emails[0] || CURRENT.viewerEmail;
  }
  if (CURRENT.targetEmail) sel.value = CURRENT.targetEmail;

  sel.onchange = async () => {
    await selectTarget(sel.value);
  };
}

async function teacherAddStudent(){
  const email = prompt("Enter student email (must be @micds.org):");
  if (!email) return;
  if (!email.endsWith("@micds.org")) { alert("Must be @micds.org"); return; }
  await loadRecord(email); // creates if missing
  await teacherRefreshStudentList();
  await selectTarget(email);
}

async function selectTarget(email){
  if (!email) return;
  CURRENT.targetEmail = email;
  CURRENT.record = await loadRecord(email);
  renderAll();
}

function hookToolbar(){
  document.getElementById("export-btn").onclick = exportAll;
  document.getElementById("import-file").onchange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await importAll(f);
    e.target.value = "";
  };

  const addBtn = document.getElementById("teacher-new-student");
  if (addBtn) addBtn.onclick = teacherAddStudent;
}

async function startAppUI({viewerEmail, role}){
  CURRENT.viewerEmail = viewerEmail;
  CURRENT.role = role;
  CURRENT.targetEmail = viewerEmail;

  document.getElementById("user-pill").textContent = viewerEmail;
  document.getElementById("role-pill").textContent = role;

  // nav
  navInit();

  // show teacher panel if needed
  const tp = document.getElementById("teacher-panel");
  if (role === "Teacher") tp.classList.remove("hidden");
  else tp.classList.add("hidden");

  // load initial record
  await selectTarget(viewerEmail);

  // if teacher, load list & keep selected
  await teacherRefreshStudentList();

  // toolbar
  hookToolbar();
}

function scoreClass(n){
  if (n === 4) return "cell-4";
  if (n === 3) return "cell-3";
  if (n === 2) return "cell-2";
  if (n === 1) return "cell-1";
  return "";
}

function clampScore(v){
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < 1) return 1;
  if (n > 4) return 4;
  return n;
}

function avg(nums){
  const xs = nums.filter(x => typeof x === "number");
  if (!xs.length) return null;
  return xs.reduce((a,b)=>a+b,0)/xs.length;
}

function deepSet(obj, path, value){
  const copy = structuredClone(obj || {});
  let cur = copy;
  for (let i=0;i<path.length-1;i++){
    const k = path[i];
    cur[k] = cur[k] ?? {};
    cur = cur[k];
  }
  cur[path[path.length-1]] = value;
  return copy;
}

function makeScoreSelect(value, disabled, onChange){
  const sel = document.createElement("select");
  sel.innerHTML = `<option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option>`;
  sel.value = (value ?? "") === null ? "" : (value ?? "");
  sel.disabled = disabled;
  sel.onchange = () => onChange(clampScore(sel.value));
  return sel;
}

function computeATLScore(n){
  if (n === 0) return 4;
  if (n >= 1 && n <= 3) return 3;
  if (n >= 4 && n <= 6) return 2;
  return 1;
}

function computeStandardGrade(state, standardId){
  const s = state?.[standardId] || {};
  // Prefer teacher scores for grade (matches typical rubric behavior)
  if (standardId === "s1"){
    const t = s.teacher || {};
    return avg(Object.values(t).map(clampScore));
  }
  if (standardId === "s4"){
    const scores = Object.values(s.teacherScores || {}).map(clampScore);
    const ratings = Object.values(s.teacherRatings || {}).map(clampScore);
    return avg([...scores, ...ratings]);
  }
  const scores = Object.values(s.teacherScores || {}).map(clampScore);
  return avg(scores);
}

function updateKPIs(state){
  const s1 = computeStandardGrade(state, "s1");
  const s2 = computeStandardGrade(state, "s2");
  const s3 = computeStandardGrade(state, "s3");
  const s4 = computeStandardGrade(state, "s4");

  const set = (id, v) => document.getElementById(id).textContent = (typeof v === "number" ? v.toFixed(2) : "—");
  set("s1-grade", s1);
  set("s2-grade", s2);
  set("s3-grade", s3);
  set("s4-grade", s4);

  const final = avg([s1,s2,s3,s4].filter(x => typeof x === "number"));
  document.getElementById("final-grade").textContent = (typeof final === "number" ? final.toFixed(2) : "—");
}

function setView(viewId){
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById(`view-${viewId}`).classList.remove("hidden");

  document.querySelectorAll(".navbtn").forEach(b => b.classList.remove("active"));
  const btn = document.querySelector(`.navbtn[data-view="${viewId}"]`);
  if (btn) btn.classList.add("active");
}

function wireNav(){
  document.querySelectorAll(".navbtn").forEach(btn=>{
    btn.onclick = () => setView(btn.dataset.view);
  });
}

function renderNavAndViews(){
  const nav = document.getElementById("nav-sections");
  const views = document.getElementById("dynamic-views");
  nav.innerHTML = "";
  views.innerHTML = "";

  for (const st of APP.standards){
    const b = document.createElement("button");
    b.className = "navbtn";
    b.dataset.view = st.id;
    b.textContent = st.nav;
    nav.appendChild(b);

    const section = document.createElement("section");
    section.className = "sheet-card view hidden";
    section.id = `view-${st.id}`;

    const h2 = document.createElement("div");
    h2.className = "sheet-h2";
    h2.textContent = st.title;
    section.appendChild(h2);

    const body = document.createElement("div");
    body.id = `mount-${st.id}`;
    section.appendChild(body);

    views.appendChild(section);
  }
}

function renderSkillsTable(mount, standardId, rows, state, perms, onPatch){
  const s = state?.[standardId] ?? {};
  const student = s.student ?? {};
  const teacher = s.teacher ?? {};

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const table = document.createElement("table");
  table.className = "sheet-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-skill">Skill</th>
        <th class="col-student">Student (1–4)</th>
        <th class="col-teacher">Teacher (1–4)</th>
      </tr>
    </thead>
  `;

  const tb = document.createElement("tbody");
  rows.forEach(r=>{
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = r.label;

    const tdS = document.createElement("td");
    const sv = clampScore(student[r.key]);
    tdS.className = scoreClass(sv);
    tdS.appendChild(makeScoreSelect(sv, !perms.canEditSelf, (val)=>{
      onPatch([standardId,"student",r.key], val);
    }));

    const tdT = document.createElement("td");
    const tv = clampScore(teacher[r.key]);
    tdT.className = scoreClass(tv);
    tdT.appendChild(makeScoreSelect(tv, !perms.canEditTeacher, (val)=>{
      onPatch([standardId,"teacher",r.key], val);
    }));

    tr.appendChild(tdLabel);
    tr.appendChild(tdS);
    tr.appendChild(tdT);
    tb.appendChild(tr);
  });

  table.appendChild(tb);
  wrap.appendChild(table);
  mount.innerHTML = "";
  mount.appendChild(wrap);
}

function renderQuestions(mount, standardId, rows, state, perms, onPatch){
  const s = state?.[standardId] ?? {};
  const ans = s.studentAnswers ?? {};
  const tscores = s.teacherScores ?? {};
  const reassess = s.reassess ?? {};

  mount.innerHTML = "";

  rows.forEach((q, idx)=>{
    const card = document.createElement("div");
    card.className = "sheet-card inner";
    card.style.marginBottom = "12px";

    const title = document.createElement("div");
    title.innerHTML = `<b>${q.label}</b><span class="badge">#${idx+1}</span>`;
    card.appendChild(title);

    const prompt = document.createElement("div");
    prompt.className = "small";
    prompt.style.marginTop = "6px";
    prompt.textContent = q.prompt;
    card.appendChild(prompt);

    const table = document.createElement("table");
    table.className = "sheet-table";
    table.style.marginTop = "10px";
    table.innerHTML = `
      <thead>
        <tr>
          <th class="col-skill">Student response</th>
          <th class="col-teacher">Teacher score (1–4)</th>
        </tr>
      </thead>
    `;

    const tr = document.createElement("tr");

    const tdA = document.createElement("td");
    const ta = document.createElement("textarea");
    ta.value = ans[q.key] ?? "";
    ta.disabled = !perms.canEditSelf;
    ta.oninput = () => onPatch([standardId,"studentAnswers",q.key], ta.value);
    tdA.appendChild(ta);

    const tdT = document.createElement("td");
    const tVal = clampScore(tscores[q.key]);
    tdT.className = scoreClass(tVal);
    tdT.appendChild(makeScoreSelect(tVal, !perms.canEditTeacher, (val)=>{
      onPatch([standardId,"teacherScores",q.key], val);
    }));

    tr.appendChild(tdA);
    tr.appendChild(tdT);

    const tb = document.createElement("tbody");
    tb.appendChild(tr);
    table.appendChild(tb);

    card.appendChild(table);

    // Reassessment row (unlocked if teacher score <=2)
    const unlock = (tVal !== null && tVal <= 2);
    const rLabel = document.createElement("div");
    rLabel.className = "label";
    rLabel.textContent = "Reassessment (unlocked if teacher score is 1–2)";
    card.appendChild(rLabel);

    const rTA = document.createElement("textarea");
    rTA.value = reassess[q.key] ?? "";
    rTA.disabled = !(perms.canEditSelf && unlock);
    rTA.placeholder = unlock ? "Reattempt / reflection..." : "Locked until teacher score is 1–2";
    rTA.oninput = () => onPatch([standardId,"reassess",q.key], rTA.value);
    card.appendChild(rTA);

    mount.appendChild(card);
  });
}

function renderRatingsTable(mount, standardId, ratings, state, perms, onPatch){
  const s = state?.[standardId] ?? {};
  const sr = s.studentRatings ?? {};
  const tr = s.teacherRatings ?? {};

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const table = document.createElement("table");
  table.className = "sheet-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-skill">Rating</th>
        <th class="col-student">Student (1–4)</th>
        <th class="col-teacher">Teacher (1–4)</th>
      </tr>
    </thead>
  `;

  const tb = document.createElement("tbody");
  ratings.forEach(r=>{
    const row = document.createElement("tr");

    const tdL = document.createElement("td");
    tdL.textContent = r.label;

    const tdS = document.createElement("td");
    const sv = clampScore(sr[r.key]);
    tdS.className = scoreClass(sv);
    tdS.appendChild(makeScoreSelect(sv, !perms.canEditSelf, (val)=> onPatch([standardId,"studentRatings",r.key], val)));

    const tdT = document.createElement("td");
    const tv = clampScore(tr[r.key]);
    tdT.className = scoreClass(tv);
    tdT.appendChild(makeScoreSelect(tv, !perms.canEditTeacher, (val)=> onPatch([standardId,"teacherRatings",r.key], val)));

    row.appendChild(tdL); row.appendChild(tdS); row.appendChild(tdT);
    tb.appendChild(row);
  });

  table.appendChild(tb);
  wrap.appendChild(table);
  mount.innerHTML = "";
  mount.appendChild(wrap);
}

function renderATL(mount, state, perms, onPatch){
  const atl = state?.atl ?? {};
  mount.innerHTML = "";

  const card1 = document.createElement("div");
  card1.className = "sheet-card inner";
  card1.style.marginBottom = "12px";
  card1.innerHTML = `<div class="sheet-h3">Days Late / Unprepared</div>`;

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = "# classes late/unprepared";
  card1.appendChild(label);

  const input = document.createElement("input");
  input.type = "number"; input.min = "0"; input.step = "1";
  input.value = Number(atl.lateCount ?? 0);
  input.disabled = !perms.canEditSelf;
  input.oninput = () => onPatch(["atl","lateCount"], Number(input.value || 0));
  card1.appendChild(input);

  const score = document.createElement("div");
  score.className = "label";
  score.style.marginTop = "10px";
  score.textContent = `ATL Score: ${computeATLScore(Number(input.value || 0))}  (0→4, 1–3→3, 4–6→2, >6→1)`;
  card1.appendChild(score);

  mount.appendChild(card1);

  const card2 = document.createElement("div");
  card2.className = "sheet-card inner";
  card2.innerHTML = `<div class="sheet-h3">Effort Ratings</div>`;
  mount.appendChild(card2);

  renderRatingsTable(card2, "atl", APP.standards.find(s=>s.id==="atl").effortRatings, state, perms, onPatch);
}

function renderAll(state, perms, onPatch){
  // honor code
  const hc = document.getElementById("honor-code");
  hc.checked = !!state?.honorCode;
  hc.disabled = !perms.canEditSelf;
  hc.onchange = () => onPatch(["honorCode"], !!hc.checked);

  // sections
  for (const st of APP.standards){
    const mount = document.getElementById(`mount-${st.id}`);
    if (!mount) continue;

    if (st.type === "skills"){
      renderSkillsTable(mount, st.id, st.rows, state, perms, onPatch);
    } else if (st.type === "questions"){
      renderQuestions(mount, st.id, st.rows, state, perms, onPatch);
    } else if (st.type === "mixed"){
      const ratingsCard = document.createElement("div");
      ratingsCard.className = "sheet-card inner";
      ratingsCard.style.marginBottom = "12px";
      ratingsCard.innerHTML = `<div class="sheet-h3">Ratings</div>`;
      mount.innerHTML = "";
      mount.appendChild(ratingsCard);
      renderRatingsTable(ratingsCard, st.id, st.ratings, state, perms, onPatch);

      const qCard = document.createElement("div");
      qCard.className = "sheet-card inner";
      qCard.innerHTML = `<div class="sheet-h3">Understanding Questions</div>`;
      mount.appendChild(qCard);
      renderQuestions(qCard, st.id, st.rows, state, perms, onPatch);
    } else if (st.type === "atl"){
      renderATL(mount, state, perms, onPatch);
    }
  }

  updateKPIs(state);
}

window.__APP_RENDER = { renderNavAndViews, renderAll, deepSet, updateKPIs };

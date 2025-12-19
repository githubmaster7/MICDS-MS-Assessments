const auth = firebase.auth();

const TEACHER_WHITELIST = APP.teacherWhitelist.map(e => e.toLowerCase());

let CURRENT_ROLE = "Student";
let CURRENT_USER_EMAIL = null;
let TARGET_STUDENT_EMAIL = null;
let STATE = {};

function showLogin(msg){
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  const err = document.getElementById("login-error");
  if (msg){
    err.textContent = msg;
    err.classList.remove("hidden");
  } else {
    err.classList.add("hidden");
  }
}

function showApp(email, role){
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("user-pill").textContent = email;
  document.getElementById("role-pill").textContent = role;
}

document.getElementById("login-btn").onclick = async () => {
  try{
    await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  } catch (e){
    showLogin(e?.message || "Login failed");
  }
};

document.getElementById("logout-btn").onclick = () => auth.signOut();

auth.onAuthStateChanged(async (user) => {
  if (!user){
    CURRENT_USER_EMAIL = null;
    showLogin();
    return;
  }

  const email = (user.email || "").toLowerCase();
  if (!email.endsWith(APP.micdsDomain)){
    await auth.signOut();
    showLogin("MICDS accounts only.");
    return;
  }

  CURRENT_USER_EMAIL = email;
  CURRENT_ROLE = TEACHER_WHITELIST.includes(email) ? "Teacher" : "Student";
  showApp(email, CURRENT_ROLE);

  // build nav + views
  window.__APP_RENDER.renderNavAndViews();
  wireNav();

  // teacher panel
  const teacherPanel = document.getElementById("teacher-panel");
  if (CURRENT_ROLE === "Teacher"){
    teacherPanel.classList.remove("hidden");
    await refreshTeacherList();
    TARGET_STUDENT_EMAIL = await defaultTeacherTarget();
  } else {
    teacherPanel.classList.add("hidden");
    TARGET_STUDENT_EMAIL = email;
  }

  await loadAndRender();

  // export/import
  wireExportImport();
});

async function refreshTeacherList(){
  const sel = document.getElementById("teacher-student-select");
  const students = await listStudents();
  sel.innerHTML = "";
  students.forEach(e=>{
    const opt = document.createElement("option");
    opt.value = e; opt.textContent = e;
    sel.appendChild(opt);
  });

  sel.onchange = async () => {
    TARGET_STUDENT_EMAIL = sel.value;
    await loadAndRender();
  };

  document.getElementById("teacher-new-student").onclick = async () => {
    const raw = prompt("Enter student MICDS email (student@micds.org):");
    if (!raw) return;
    const e = raw.trim().toLowerCase();
    if (!e.endsWith(APP.micdsDomain)){
      alert("Must be @micds.org");
      return;
    }
    await saveRecord(e, { createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    await refreshTeacherList();
    TARGET_STUDENT_EMAIL = e;
    document.getElementById("teacher-student-select").value = e;
    await loadAndRender();
  };
}

async function defaultTeacherTarget(){
  const sel = document.getElementById("teacher-student-select");
  if (sel.options.length) return sel.options[0].value;
  return CURRENT_USER_EMAIL; // fallback
}

async function loadAndRender(){
  STATE = (await getRecord(TARGET_STUDENT_EMAIL)) || {};
  const perms = {
    canEditSelf: (CURRENT_ROLE === "Student"),
    canEditTeacher: (CURRENT_ROLE === "Teacher")
  };

  const onPatch = async (path, value) => {
    STATE = window.__APP_RENDER.deepSet(STATE, path, value);
    await saveRecord(TARGET_STUDENT_EMAIL, STATE);
    window.__APP_RENDER.renderAll(STATE, perms, onPatch);
  };

  window.__APP_RENDER.renderAll(STATE, perms, onPatch);

  // If teacher, keep dropdown synced
  if (CURRENT_ROLE === "Teacher"){
    const sel = document.getElementById("teacher-student-select");
    if (sel) sel.value = TARGET_STUDENT_EMAIL;
  }
}

function wireExportImport(){
  document.getElementById("export-btn").onclick = () => {
    const payload = { student: TARGET_STUDENT_EMAIL, data: STATE };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${TARGET_STUDENT_EMAIL.replace(/[@.]/g,"_")}_assessment.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  document.getElementById("import-file").onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text);

    if (!payload?.student || !payload?.data){
      alert("Invalid import file");
      return;
    }

    const target = payload.student.toLowerCase();
    if (CURRENT_ROLE !== "Teacher" && target !== CURRENT_USER_EMAIL){
      alert("Students can only import their own record.");
      return;
    }

    await saveRecord(target, payload.data);
    if (CURRENT_ROLE === "Teacher") await refreshTeacherList();
    TARGET_STUDENT_EMAIL = target;
    await loadAndRender();
  };
}

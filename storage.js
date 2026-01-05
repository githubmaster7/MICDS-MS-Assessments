// storage.js
const KEY = "micds_assessment_v1";
const ADMIN_KEY = "micds_admin_v1";
const CLASSES_KEY = "micds_classes_v1";
const ROTATION_KEY = "micds_rotation_orders_v1";

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

export function ensureStudent(email, name = null, grade = null, gender = null){
  const db = loadDB();
  const e = (email || "").trim().toLowerCase();
  if (!e) throw new Error("Missing email");

  if (!db.students[e]){
    db.students[e] = {
      email: e,
      name: name || null,
      grade: grade || null,
      gender: gender || null, // "male", "female", or null
      createdAt: nowIso(),
      updatedAt: nowIso(),
      honorCode: false,
      student: { scores: {}, proofs: {} },
      teacher: { scores: {}, notes: {} },
    };
    if (!db.roster.includes(e)) db.roster.push(e);
    saveDB(db);
  } else {
    // Update existing student if new info provided
    if (name !== null) db.students[e].name = name;
    if (grade !== null) db.students[e].grade = grade;
    if (gender !== null) db.students[e].gender = gender;
    db.students[e].updatedAt = nowIso();
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

// Admin functions for managing teachers and students
export function loadAdminDB(){
  try{
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return { teachers: [], students: [], admins: ["admin@micds.org"], parents: {}, parentChildren: {}, passwords: {} };
    const db = JSON.parse(raw);
    if (!db.teachers) db.teachers = [];
    if (!db.students) db.students = [];
    if (!db.admins) db.admins = ["admin@micds.org"];
    if (!db.parents) db.parents = {};
    if (!db.parentChildren) db.parentChildren = {};
    if (!db.passwords) db.passwords = {};
    return db;
  }catch{
    return { teachers: [], students: [], admins: ["admin@micds.org"], parents: {}, parentChildren: {}, passwords: {} };
  }
}

export function setUserPassword(email, password){
  const db = loadAdminDB();
  const e = (email || "").trim().toLowerCase();
  if (!e || !e.endsWith("@micds.org")) throw new Error("Invalid email");
  if (!db.passwords) db.passwords = {};
  // Simple password storage (in production, use proper hashing)
  db.passwords[e] = password;
  saveAdminDB(db);
}

export function verifyUserPassword(email, password){
  const db = loadAdminDB();
  const e = (email || "").trim().toLowerCase();
  if (!db.passwords) return false;
  return db.passwords[e] === password;
}

export function hasPassword(email){
  const db = loadAdminDB();
  const e = (email || "").trim().toLowerCase();
  if (!db.passwords) return false;
  return !!db.passwords[e];
}

export function saveAdminDB(db){
  localStorage.setItem(ADMIN_KEY, JSON.stringify(db));
}

export function addTeacher(email){
  const db = loadAdminDB();
  const e = (email || "").trim().toLowerCase();
  if (!e || !e.endsWith("@micds.org")) throw new Error("Invalid email");
  if (!db.teachers.includes(e)) {
    db.teachers.push(e);
    saveAdminDB(db);
  }
  return db.teachers;
}

export function removeTeacher(email){
  const db = loadAdminDB();
  const e = (email || "").trim().toLowerCase();
  db.teachers = db.teachers.filter(t => t !== e);
  saveAdminDB(db);
  return db.teachers;
}

export function addStudent(email, name = null, grade = null, gender = null){
  const db = loadAdminDB();
  const e = (email || "").trim().toLowerCase();
  if (!e || !e.endsWith("@micds.org")) throw new Error("Invalid email");
  if (!db.students.includes(e)) {
    db.students.push(e);
    saveAdminDB(db);
    // Also ensure student record exists with additional info
    ensureStudent(e, name, grade, gender);
  } else {
    // Update existing student info
    updateStudentInfo(e, name, grade, gender);
  }
  return db.students;
}

export function removeStudent(email){
  const db = loadAdminDB();
  const e = (email || "").trim().toLowerCase();
  db.students = db.students.filter(s => s !== e);
  saveAdminDB(db);
  return db.students;
}

export function getAllTeachers(){
  const db = loadAdminDB();
  return db.teachers.slice().sort();
}

export function getAllAssignedStudents(){
  const db = loadAdminDB();
  return db.students.slice().sort();
}

export function isAssignedTeacher(email){
  const db = loadAdminDB();
  return db.teachers.includes((email || "").trim().toLowerCase());
}

export function isAssignedStudent(email){
  const db = loadAdminDB();
  return db.students.includes((email || "").trim().toLowerCase());
}

export function isAssignedAdmin(email){
  const db = loadAdminDB();
  return db.admins.includes((email || "").trim().toLowerCase());
}

export function getUserRole(email){
  const e = (email || "").trim().toLowerCase();
  if (isAssignedAdmin(e)) return "admin";
  if (isAssignedTeacher(e)) return "teacher";
  if (isAssignedStudent(e)) return "student";
  if (isAssignedParent(e)) return "parent";
  return null; // Not assigned
}

export function isAssignedParent(email){
  const db = loadAdminDB();
  return db.parents && db.parents[(email || "").trim().toLowerCase()] === true;
}

export function addParent(email, childrenEmails = []){
  const db = loadAdminDB();
  const e = (email || "").trim().toLowerCase();
  if (!e || !e.endsWith("@micds.org")) throw new Error("Invalid email");
  
  if (!db.parents) db.parents = {};
  if (!db.parentChildren) db.parentChildren = {};
  
  db.parents[e] = true;
  db.parentChildren[e] = childrenEmails.map(child => child.trim().toLowerCase()).filter(child => child);
  
  saveAdminDB(db);
  return { parent: e, children: db.parentChildren[e] };
}

export function getParentChildren(parentEmail){
  const db = loadAdminDB();
  const e = (parentEmail || "").trim().toLowerCase();
  if (!db.parentChildren) return [];
  return db.parentChildren[e] || [];
}

export function addChildToParent(parentEmail, childEmail){
  const db = loadAdminDB();
  const parentE = (parentEmail || "").trim().toLowerCase();
  const childE = (childEmail || "").trim().toLowerCase();
  
  if (!db.parentChildren) db.parentChildren = {};
  if (!db.parentChildren[parentE]) db.parentChildren[parentE] = [];
  
  if (!db.parentChildren[parentE].includes(childE)) {
    db.parentChildren[parentE].push(childE);
    saveAdminDB(db);
  }
  
  return db.parentChildren[parentE];
}

export function removeChildFromParent(parentEmail, childEmail){
  const db = loadAdminDB();
  const parentE = (parentEmail || "").trim().toLowerCase();
  const childE = (childEmail || "").trim().toLowerCase();
  
  if (!db.parentChildren) return [];
  if (!db.parentChildren[parentE]) return [];
  
  db.parentChildren[parentE] = db.parentChildren[parentE].filter(c => c !== childE);
  saveAdminDB(db);
  
  return db.parentChildren[parentE];
}

// Classes and student-class assignments
export function loadClasses(){
  try{
    const raw = localStorage.getItem(CLASSES_KEY);
    if (!raw) return { classes: {}, studentClasses: {} };
    return JSON.parse(raw);
  }catch{
    return { classes: {}, studentClasses: {} };
  }
}

export function saveClasses(data){
  localStorage.setItem(CLASSES_KEY, JSON.stringify(data));
}

export function addClass(className, teacherEmail, gender = null, gradeLevel = null){
  const data = loadClasses();
  const name = (className || "").trim();
  if (!name) throw new Error("Class name required");
  
  if (!data.classes[name]){
    data.classes[name] = {
      name: name,
      teacherEmail: teacherEmail,
      gender: gender || null, // "all-girls", "all-boys", or null
      gradeLevel: gradeLevel || null, // e.g., "6", "7", "8", etc.
      createdAt: nowIso(),
      students: []
    };
    saveClasses(data);
  }
  return data.classes[name];
}

export function removeClass(className){
  const data = loadClasses();
  const name = (className || "").trim();
  if (data.classes[name]){
    // Remove class and all student assignments
    delete data.classes[name];
    // Remove from studentClasses mapping
    for (const email in data.studentClasses){
      data.studentClasses[email] = data.studentClasses[email].filter(c => c !== name);
      if (data.studentClasses[email].length === 0){
        delete data.studentClasses[email];
      }
    }
    saveClasses(data);
  }
  return data.classes;
}

export function addStudentToClass(studentEmail, className){
  const data = loadClasses();
  const email = (studentEmail || "").trim().toLowerCase();
  const name = (className || "").trim();
  
  if (!email || !name) throw new Error("Email and class name required");
  
  // Add to class
  if (!data.classes[name]){
    throw new Error("Class does not exist");
  }
  if (!data.classes[name].students.includes(email)){
    data.classes[name].students.push(email);
  }
  
  // Add to studentClasses mapping
  if (!data.studentClasses[email]){
    data.studentClasses[email] = [];
  }
  if (!data.studentClasses[email].includes(name)){
    data.studentClasses[email].push(name);
  }
  
  saveClasses(data);
  return data;
}

export function removeStudentFromClass(studentEmail, className){
  const data = loadClasses();
  const email = (studentEmail || "").trim().toLowerCase();
  const name = (className || "").trim();
  
  // Remove from class
  if (data.classes[name]){
    data.classes[name].students = data.classes[name].students.filter(e => e !== email);
  }
  
  // Remove from studentClasses mapping
  if (data.studentClasses[email]){
    data.studentClasses[email] = data.studentClasses[email].filter(c => c !== name);
    if (data.studentClasses[email].length === 0){
      delete data.studentClasses[email];
    }
  }
  
  saveClasses(data);
  return data;
}

export function getClassesForTeacher(teacherEmail){
  const data = loadClasses();
  const classes = [];
  for (const name in data.classes){
    if (data.classes[name].teacherEmail === teacherEmail){
      classes.push(data.classes[name]);
    }
  }
  return classes;
}

export function getStudentsInClass(className){
  const data = loadClasses();
  const name = (className || "").trim();
  if (!data.classes[name]) return [];
  return data.classes[name].students || [];
}

export function getAllStudentsWithNames(){
  const db = loadDB();
  const students = [];
  for (const email in db.students){
    const student = db.students[email];
    const username = email.replace("@micds.org", "");
    // Try to extract name from email (e.g., "alice.smith@micds.org" -> "Alice Smith")
    const nameParts = username.split(".");
    const displayName = nameParts.map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(" ");
    students.push({
      email: email,
      username: username,
      displayName: displayName,
      student: student
    });
  }
  return students.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// Admin functions for updating/replacing users and classes
export function updateTeacherEmail(oldEmail, newEmail){
  const db = loadAdminDB();
  const oldE = (oldEmail || "").trim().toLowerCase();
  const newE = (newEmail || "").trim().toLowerCase();
  if (!newE || !newE.endsWith("@micds.org")) throw new Error("Invalid email");
  if (!db.teachers.includes(oldE)) throw new Error("Teacher not found");
  if (db.teachers.includes(newE) && newE !== oldE) throw new Error("New email already exists");
  
  // Update in teachers list
  const index = db.teachers.indexOf(oldE);
  if (index !== -1) {
    db.teachers[index] = newE;
  }
  
  // Update in classes
  const classData = loadClasses();
  for (const className in classData.classes){
    if (classData.classes[className].teacherEmail === oldE){
      classData.classes[className].teacherEmail = newE;
    }
  }
  saveClasses(classData);
  saveAdminDB(db);
  return db.teachers;
}

export function updateStudentEmail(oldEmail, newEmail){
  const db = loadAdminDB();
  const oldE = (oldEmail || "").trim().toLowerCase();
  const newE = (newEmail || "").trim().toLowerCase();
  if (!newE || !newE.endsWith("@micds.org")) throw new Error("Invalid email");
  if (!db.students.includes(oldE)) throw new Error("Student not found");
  if (db.students.includes(newE) && newE !== oldE) throw new Error("New email already exists");
  
  // Update in students list
  const index = db.students.indexOf(oldE);
  if (index !== -1) {
    db.students[index] = newE;
  }
  
  // Update student record in main DB
  const mainDB = loadDB();
  if (mainDB.students[oldE]){
    mainDB.students[newE] = mainDB.students[oldE];
    mainDB.students[newE].email = newE;
    delete mainDB.students[oldE];
    // Update roster
    const rosterIndex = mainDB.roster.indexOf(oldE);
    if (rosterIndex !== -1) {
      mainDB.roster[rosterIndex] = newE;
    }
    saveDB(mainDB);
  }
  
  // Update in classes
  const classData = loadClasses();
  for (const className in classData.classes){
    const studentIndex = classData.classes[className].students.indexOf(oldE);
    if (studentIndex !== -1) {
      classData.classes[className].students[studentIndex] = newE;
    }
  }
  // Update studentClasses mapping
  if (classData.studentClasses[oldE]){
    classData.studentClasses[newE] = classData.studentClasses[oldE];
    delete classData.studentClasses[oldE];
  }
  saveClasses(classData);
  saveAdminDB(db);
  return db.students;
}

export function updateClassTeacher(className, newTeacherEmail){
  const data = loadClasses();
  const name = (className || "").trim();
  const newTeacher = (newTeacherEmail || "").trim().toLowerCase();
  if (!name || !data.classes[name]) throw new Error("Class not found");
  if (!newTeacher || !newTeacher.endsWith("@micds.org")) throw new Error("Invalid teacher email");
  
  data.classes[name].teacherEmail = newTeacher;
  saveClasses(data);
  return data.classes[name];
}

export function updateClassName(oldName, newName){
  const data = loadClasses();
  const old = (oldName || "").trim();
  const newN = (newName || "").trim();
  if (!old || !data.classes[old]) throw new Error("Class not found");
  if (!newN) throw new Error("New class name required");
  if (data.classes[newN] && newN !== old) throw new Error("New class name already exists");
  
  // Update class
  data.classes[newN] = data.classes[old];
  data.classes[newN].name = newN;
  delete data.classes[old];
  
  // Update studentClasses mapping
  for (const email in data.studentClasses){
    const index = data.studentClasses[email].indexOf(old);
    if (index !== -1) {
      data.studentClasses[email][index] = newN;
    }
  }
  
  saveClasses(data);
  return data.classes;
}

export function updateClassGender(className, gender){
  const data = loadClasses();
  const name = (className || "").trim();
  if (!name || !data.classes[name]) throw new Error("Class not found");
  if (gender && gender !== "all-girls" && gender !== "all-boys") {
    throw new Error("Gender must be 'all-girls', 'all-boys', or null");
  }
  
  data.classes[name].gender = gender || null;
  saveClasses(data);
  return data.classes[name];
}

export function updateClassGradeLevel(className, gradeLevel){
  const data = loadClasses();
  const name = (className || "").trim();
  if (!name || !data.classes[name]) throw new Error("Class not found");
  
  data.classes[name].gradeLevel = gradeLevel || null;
  saveClasses(data);
  return data.classes[name];
}

// Rotation orders storage
export function loadRotationOrders(){
  try{
    const raw = localStorage.getItem(ROTATION_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  }catch{
    return {};
  }
}

export function saveRotationOrders(orders){
  localStorage.setItem(ROTATION_KEY, JSON.stringify(orders));
}

export function getRotationOrderKey(grade, gender){
  const gradeStr = grade || "mixed";
  const genderStr = gender === "all-girls" ? "girls" : gender === "all-boys" ? "boys" : "mixed";
  return `grade-${gradeStr}-${genderStr}`;
}

export function getRotationOrder(grade, gender){
  const orders = loadRotationOrders();
  const key = getRotationOrderKey(grade, gender);
  return orders[key] || [];
}

export function saveRotationOrder(grade, gender, classNames){
  const orders = loadRotationOrders();
  const key = getRotationOrderKey(grade, gender);
  orders[key] = classNames;
  saveRotationOrders(orders);
  return orders;
}

export function updateStudentInfo(email, name = null, grade = null, gender = null){
  const db = loadDB();
  const e = (email || "").trim().toLowerCase();
  if (!e || !db.students[e]) throw new Error("Student not found");
  
  if (name !== null) db.students[e].name = name;
  if (grade !== null) db.students[e].grade = grade;
  if (gender !== null) {
    if (gender !== "male" && gender !== "female" && gender !== null) {
      throw new Error("Gender must be 'male', 'female', or null");
    }
    db.students[e].gender = gender;
  }
  db.students[e].updatedAt = nowIso();
  saveDB(db);
  return db.students[e];
}

export function getAllClasses(){
  const data = loadClasses();
  return Object.values(data.classes).sort((a, b) => a.name.localeCompare(b.name));
}

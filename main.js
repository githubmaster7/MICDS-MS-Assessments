import { loadAll, saveAll, emptyStudent } from "./storage.js";
import { renderStudentChart, renderTeacherChart } from "./charts.js";

let allData = loadAll();
let currentEmail = null;
let isTeacher = false;

const content = document.getElementById("content");

document.getElementById("loadBtn").onclick = () => {
  currentEmail = document.getElementById("studentEmail").value.trim();
  if (!currentEmail) return alert("Enter email");

  if (!allData[currentEmail]) {
    allData[currentEmail] = emptyStudent();
    saveAll(allData);
  }
  render();
};

document.getElementById("roleToggle").onchange = e => {
  isTeacher = e.target.checked;
  render();
};

function effectiveScore(s) {
  return s.teacher ?? s.student;
}

function render() {
  if (!currentEmail) return;

  const student = allData[currentEmail];

  content.innerHTML = `
    <h3>Current Grade</h3>
    <h1>${grade(student)}</h1>

    ${Object.entries(student.standards).map(([k,v]) => `
      <div class="row">
        <strong>${k.toUpperCase()}</strong>

        <label>Student:
          <select onchange="setStudent('${k}', this.value)">
            <option value=""></option>
            ${[1,2,3,4].map(n=>`<option ${v.student==n?"selected":""}>${n}</option>`)}
          </select>
        </label>

        ${isTeacher ? `
        <label>Teacher:
          <select onchange="setTeacher('${k}', this.value)">
            <option value=""></option>
            ${[1,2,3,4].map(n=>`<option ${v.teacher==n?"selected":""}>${n}</option>`)}
          </select>
        </label>` : ""}
      </div>
    `).join("")}
  `;

  renderStudentChart(student.standards);

  document.getElementById("teacherDashboard").style.display =
    isTeacher ? "block" : "none";

  if (isTeacher) renderTeacherChart(allData);
}

window.setStudent = (std,val) => {
  allData[currentEmail].standards[std].student = val ? Number(val) : null;
  saveAll(allData);
  render();
};

window.setTeacher = (std,val) => {
  allData[currentEmail].standards[std].teacher = val ? Number(val) : null;
  saveAll(allData);
  render();
};

function grade(student) {
  const scores = Object.values(student.standards)
    .map(effectiveScore)
    .filter(v=>v!==null);
  if (!scores.length) return "—";
  return (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(2);
}

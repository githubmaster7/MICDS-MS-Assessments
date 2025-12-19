export function renderStudentChart(standards) {
  const ctx = document.getElementById("studentChart");

  new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Std 1", "Std 2", "Std 3", "Std 4"],
      datasets: [
        {
          label: "Student",
          data: Object.values(standards).map(s => s.student ?? 0),
          backgroundColor: "#9ca3af"
        },
        {
          label: "Teacher",
          data: Object.values(standards).map(s => s.teacher ?? 0),
          backgroundColor: "#2563eb"
        }
      ]
    },
    options: {
      scales: { y: { min: 0, max: 4 } }
    }
  });
}

export function renderTeacherChart(allStudents) {
  const ctx = document.getElementById("teacherChart");

  const avg = [1,2,3,4].map(i => {
    const vals = Object.values(allStudents)
      .map(s => s.standards[`std${i}`].teacher)
      .filter(v => v !== null);
    return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
  });

  new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["Std 1","Std 2","Std 3","Std 4"],
      datasets: [{
        label: "Teacher Average",
        data: avg,
        backgroundColor: "rgba(37,99,235,.2)",
        borderColor: "#2563eb"
      }]
    },
    options: {
      scales: { r: { min: 0, max: 4 } }
    }
  });
}

// app.js
import { TABS, RUBRIC, SCORE_LEVELS, scoreBadgeClass,
         computeOverallGrade, computeStandardAverage,
         atlScoreFromLateCount, computePopulationCounts } from "./data.js";
import { ensureStudent, getStudent, updateStudent, listRoster, getAllStudents,
         setHonorCode, resetStudent, exportJSON, importJSON,
         addClass, removeClass, addStudentToClass, removeStudentFromClass,
         getClassesForTeacher, getStudentsInClass, getAllStudentsWithNames,
         loadClasses, addTeacher, removeTeacher, addStudent, removeStudent,
         getAllTeachers, getAllAssignedStudents, updateTeacherEmail, updateStudentEmail,
         updateClassTeacher, updateClassName, getAllClasses, updateClassGender,
         updateClassGradeLevel, updateStudentInfo,
         getUserRole as getUserRoleFromStorage, loadAdminDB, saveAdminDB,
         loadRotationOrders, saveRotationOrder, getRotationOrder, getRotationOrderKey,
         addParent, getParentChildren, addChildToParent, removeChildFromParent,
         setUserPassword, verifyUserPassword, hasPassword } from "./storage.js";
import { drawDonutCounts } from "./charts.js";

// Admin email (hardcoded - only this can access admin panel)
const ADMIN_EMAIL = "admin@micds.org";

// Hardcoded teachers and students for testing purposes
const TEACHER_EMAILS = [
  "prosen@micds.org",
  "teacher1@micds.org",
  "teacher2@micds.org"
];

const STUDENT_EMAILS = [
  "student1@micds.org",
  "student2@micds.org",
  "student3@micds.org",
  "alice.smith@micds.org",
  "bob.jones@micds.org",
  "charlie.brown@micds.org"
];

let state = {
  activeTab: "scores",
  email: "",
  isTeacher: false,
  userRole: null, // "student", "teacher", or "admin"
  loggedInUser: null, // logged in user's email
  selectedClass: null, // selected class for teachers
  adminSubTab: "students", // "students", "teachers", or "classes" for admin panel
  autoFillStudentInfo: true, // Auto-fill grade and gender from last entry
  lastStudentGrade: "", // Last entered grade
  lastStudentGender: "", // Last entered gender
  filters: {
    gradeMin: "",
    gradeMax: "",
    classFilter: "",
    standardFilter: "",
    standardRating: "",
    searchQuery: "" // Search by student name or email
  }
};

// Simple class structure - in a real app, this would come from a backend
const CLASSES = {
  "math-6a": ["alice.smith", "bob.jones", "charlie.brown"],
  "math-6b": ["diana.prince", "edward.norton", "fiona.apple"],
  "math-7a": ["george.washington", "helen.keller", "isaac.newton"],
  "math-7b": ["jane.doe", "john.smith", "kate.winslet"],
  "science-6": ["lisa.simpson", "mike.tyson", "nancy.drew"],
  "science-7": ["oliver.twist", "peter.pan", "queen.elizabeth"],
};

function $(id){ return document.getElementById(id); }

function seedDemoData(){
  // Teacher
  try { addTeacher("prosen@micds.org"); } catch(e){}
  setUserPassword("prosen@micds.org", "demo123");
  setUserPassword("admin@micds.org", "demo123");

  // Students
  const demos = [
    { email: "alex.johnson@micds.org",  name: "Alex Johnson",  grade: "7", gender: "male"   },
    { email: "sarah.davis@micds.org",   name: "Sarah Davis",   grade: "7", gender: "female" },
    { email: "mike.wilson@micds.org",   name: "Mike Wilson",   grade: "7", gender: "male"   },
  ];
  demos.forEach(s => {
    try { addStudent(s.email, s.name, s.grade, s.gender); } catch(e){}
    setUserPassword(s.email, "demo123");
  });

  // Class
  try { addClass("PE 7A", "prosen@micds.org", null, "7"); } catch(e){}
  demos.forEach(s => { try { addStudentToClass(s.email, "PE 7A"); } catch(e){} });

  // Pre-filled scores
  ensureStudent("alex.johnson@micds.org", "Alex Johnson", "7", "male");
  updateStudent("alex.johnson@micds.org", r => {
    r.student.scores = { s1_q1:3, s1_q2:2, s1_q3:3, s2_q1:3, s2_q2:4, s2_q3:2, s3_q1:2, s3_q2:3, s3_q3:3, s4_q1:4, s4_q2:3, s4_q3:3, atl_effort:3, atl_follow:4, atl_task:3, atl_late:1 };
    r.teacher.scores = { s1_q2:3 };
    r.honorCode = true;
  });
  ensureStudent("sarah.davis@micds.org", "Sarah Davis", "7", "female");
  updateStudent("sarah.davis@micds.org", r => {
    r.student.scores = { s1_q1:4, s1_q2:3, s1_q3:4, s2_q1:3, s2_q2:3, s2_q3:4, s3_q1:3, s3_q2:4, s3_q3:3, s4_q1:4, s4_q2:4, s4_q3:4, atl_effort:4, atl_follow:4, atl_task:4, atl_late:0 };
    r.honorCode = true;
  });
  ensureStudent("mike.wilson@micds.org", "Mike Wilson", "7", "male");
  updateStudent("mike.wilson@micds.org", r => {
    r.student.scores = { s1_q1:2, s1_q2:1, s1_q3:2, s2_q1:2, s2_q2:2, s2_q3:1, s3_q1:2, s3_q2:1, s3_q3:2, s4_q1:2, s4_q2:2, s4_q3:2, atl_effort:2, atl_follow:2, atl_task:2, atl_late:5 };
    r.teacher.scores = { s1_q2:2, s2_q3:2, s3_q2:2 };
    r.honorCode = true;
  });
}

function setStatus(msg){
  const statusEl = $("status");
  if (statusEl) statusEl.textContent = msg || "";
}

// Helper function to show forgot password modal
function showForgotPasswordModal() {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = makeEl("div", {
      id: "forgotPasswordModalOverlay",
      style: "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center;"
    });
    
    // Create modal content
    const modal = makeEl("div", {
      id: "forgotPasswordModal",
      style: "background:white; border-radius:12px; padding:24px; max-width:500px; width:90%; max-height:90vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.3);"
    });
    
    // Title
    modal.appendChild(makeEl("div", {
      style: "font-size:20px; font-weight:600; margin-bottom:20px; color:var(--ink);"
    }, ["Reset Password"]));
    
    // Description
    modal.appendChild(makeEl("div", {
      style: "font-size:13px; color:var(--muted); margin-bottom:20px; line-height:1.6;"
    }, [`Enter your email address to reset your password.`]));
    
    // Email input
    const emailContainer = makeEl("div", {
      style: "margin-bottom:20px;"
    });
    
    emailContainer.appendChild(makeEl("label", {
      style: "display:block; font-weight:600; font-size:13px; margin-bottom:6px; color:var(--ink);"
    }, ["Email Address:"]));
    
    const emailInput = makeEl("input", {
      type: "email",
      class: "input",
      style: "width:100%; padding:10px; font-size:14px;",
      placeholder: "your.name@micds.org",
      required: true
    });
    
    emailContainer.appendChild(emailInput);
    modal.appendChild(emailContainer);
    
    // New password input
    const newPasswordContainer = makeEl("div", {
      style: "margin-bottom:20px;"
    });
    
    newPasswordContainer.appendChild(makeEl("label", {
      style: "display:block; font-weight:600; font-size:13px; margin-bottom:6px; color:var(--ink);"
    }, ["New Password:"]));
    
    const newPasswordInput = makeEl("input", {
      type: "password",
      class: "input",
      style: "width:100%; padding:10px; font-size:14px;",
      placeholder: "Enter new password",
      required: true
    });
    
    newPasswordContainer.appendChild(newPasswordInput);
    modal.appendChild(newPasswordContainer);
    
    // Confirm password input
    const confirmPasswordContainer = makeEl("div", {
      style: "margin-bottom:20px;"
    });
    
    confirmPasswordContainer.appendChild(makeEl("label", {
      style: "display:block; font-weight:600; font-size:13px; margin-bottom:6px; color:var(--ink);"
    }, ["Confirm New Password:"]));
    
    const confirmPasswordInput = makeEl("input", {
      type: "password",
      class: "input",
      style: "width:100%; padding:10px; font-size:14px;",
      placeholder: "Confirm new password",
      required: true
    });
    
    confirmPasswordContainer.appendChild(confirmPasswordInput);
    modal.appendChild(confirmPasswordContainer);
    
    // Error message
    const errorDiv = makeEl("div", {
      id: "forgotPasswordError",
      style: "display:none; color:var(--red); font-size:13px; margin-bottom:16px; padding:8px; background:#fee2e2; border-radius:6px;"
    });
    modal.appendChild(errorDiv);
    
    // Buttons
    const buttonsDiv = makeEl("div", {
      style: "display:flex; gap:12px; justify-content:flex-end; margin-top:20px;"
    });
    
    const cancelBtn = makeEl("button", {
      class: "btn",
      style: "font-size:13px; padding:8px 16px; background:#f3f4f6; color:var(--ink); border:1px solid var(--grid-soft);",
      onclick: () => {
        document.body.removeChild(overlay);
        resolve(false);
      }
    }, ["Cancel"]);
    
    const resetBtn = makeEl("button", {
      class: "btn primary",
      style: "font-size:13px; padding:8px 16px;",
      onclick: () => {
        const email = emailInput.value.trim().toLowerCase();
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Validation
        if (!email) {
          errorDiv.textContent = "Please enter your email address.";
          errorDiv.style.display = "block";
          return;
        }
        if (!isValidMICDSEmail(email)) {
          errorDiv.textContent = "Please enter a valid @micds.org email address.";
          errorDiv.style.display = "block";
          return;
        }
        
        // Check if user is in the system
        const userRole = getUserRole(email);
        if (!userRole) {
          errorDiv.textContent = "This email is not registered in the system. Please try again.";
          errorDiv.style.display = "block";
          return;
        }
        
        if (!newPassword) {
          errorDiv.textContent = "Please enter a new password.";
          errorDiv.style.display = "block";
          return;
        }
        
        if (newPassword.length < 6) {
          errorDiv.textContent = "Password must be at least 6 characters long.";
          errorDiv.style.display = "block";
          return;
        }
        
        if (newPassword !== confirmPassword) {
          errorDiv.textContent = "Passwords do not match. Please try again.";
          errorDiv.style.display = "block";
          return;
        }
        
        try {
          setUserPassword(email, newPassword);
          document.body.removeChild(overlay);
          showSuccess("Password Reset", "Your password has been successfully reset.", "You can now sign in with your new password.").then(() => {});
          resolve(true);
        } catch (err) {
          errorDiv.textContent = "Unable to reset password: " + err.message;
          errorDiv.style.display = "block";
        }
      }
    }, ["Reset Password"]);
    
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(resetBtn);
    modal.appendChild(buttonsDiv);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(false);
      }
    });
    
    // Focus email input
    setTimeout(() => emailInput.focus(), 100);
  });
}

// Helper function to show sign up form modal (for new users)
function showSignUpRoleSelectionModal() {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = makeEl("div", {
      id: "signUpRoleSelectionModalOverlay",
      style: "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center;"
    });
    
    // Create modal content
    const modal = makeEl("div", {
      id: "signUpRoleSelectionModal",
      style: "background:white; border-radius:12px; padding:24px; max-width:500px; width:90%; max-height:90vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.3);"
    });
    
    // Title
    modal.appendChild(makeEl("div", {
      style: "font-size:20px; font-weight:600; margin-bottom:20px; color:var(--ink);"
    }, ["Sign Up"]));
    
    // Description
    modal.appendChild(makeEl("div", {
      style: "font-size:13px; color:var(--muted); margin-bottom:20px; line-height:1.6;"
    }, [`Please fill out the form below to create a new account.`]));
    
    // Form fields container
    const fieldsContainer = makeEl("div", {
      style: "display:flex; flex-direction:column; gap:16px; margin-bottom:20px;"
    });
    
    // Email input
    const emailContainer = makeEl("div", {});
    emailContainer.appendChild(makeEl("label", {
      style: "display:block; font-weight:600; font-size:13px; margin-bottom:6px; color:var(--ink);"
    }, ["Email Address *"]));
    const emailInput = makeEl("input", {
      type: "email",
      class: "input",
      style: "width:100%; padding:10px; font-size:14px;",
      placeholder: "your.name@micds.org",
      required: true
    });
    emailContainer.appendChild(emailInput);
    fieldsContainer.appendChild(emailContainer);
    
    // First Name input
    const firstNameContainer = makeEl("div", {});
    firstNameContainer.appendChild(makeEl("label", {
      style: "display:block; font-weight:600; font-size:13px; margin-bottom:6px; color:var(--ink);"
    }, ["First Name *"]));
    const firstNameInput = makeEl("input", {
      type: "text",
      class: "input",
      style: "width:100%; padding:10px; font-size:14px;",
      placeholder: "John",
      required: true
    });
    firstNameContainer.appendChild(firstNameInput);
    fieldsContainer.appendChild(firstNameContainer);
    
    // Last Name input
    const lastNameContainer = makeEl("div", {});
    lastNameContainer.appendChild(makeEl("label", {
      style: "display:block; font-weight:600; font-size:13px; margin-bottom:6px; color:var(--ink);"
    }, ["Last Name *"]));
    const lastNameInput = makeEl("input", {
      type: "text",
      class: "input",
      style: "width:100%; padding:10px; font-size:14px;",
      placeholder: "Doe",
      required: true
    });
    lastNameContainer.appendChild(lastNameInput);
    fieldsContainer.appendChild(lastNameContainer);
    
    // Phone Number input
    const phoneContainer = makeEl("div", {});
    phoneContainer.appendChild(makeEl("label", {
      style: "display:block; font-weight:600; font-size:13px; margin-bottom:6px; color:var(--ink);"
    }, ["Phone Number *"]));
    const phoneInput = makeEl("input", {
      type: "tel",
      class: "input",
      style: "width:100%; padding:10px; font-size:14px;",
      placeholder: "(314) 555-1234",
      required: true
    });
    phoneContainer.appendChild(phoneInput);
    fieldsContainer.appendChild(phoneContainer);
    
    // Role dropdown
    const roleContainer = makeEl("div", {});
    roleContainer.appendChild(makeEl("label", {
      style: "display:block; font-weight:600; font-size:13px; margin-bottom:6px; color:var(--ink);"
    }, ["Role *"]));
    const roleSelect = makeEl("select", {
      class: "input",
      style: "width:100%; padding:10px; font-size:14px;",
      required: true
    });
    roleSelect.appendChild(makeEl("option", { value: "" }, ["— Select Role —"]));
    roleSelect.appendChild(makeEl("option", { value: "student" }, ["Student"]));
    roleSelect.appendChild(makeEl("option", { value: "teacher" }, ["Teacher"]));
    roleContainer.appendChild(roleSelect);
    fieldsContainer.appendChild(roleContainer);
    
    // Grade input (shown only for students)
    const gradeContainer = makeEl("div", {
      id: "gradeContainer",
      style: "display:none;"
    });
    gradeContainer.appendChild(makeEl("label", {
      style: "display:block; font-weight:600; font-size:13px; margin-bottom:6px; color:var(--ink);"
    }, ["Grade Level *"]));
    const gradeInput = makeEl("input", {
      type: "text",
      class: "input",
      style: "width:100%; padding:10px; font-size:14px;",
      placeholder: "6, 7, or 8",
      id: "signUpGradeInput"
    });
    gradeContainer.appendChild(gradeInput);
    fieldsContainer.appendChild(gradeContainer);
    
    // Gender select (shown for both students and teachers)
    const genderContainer = makeEl("div", {
      id: "genderContainer",
      style: "display:none;"
    });
    genderContainer.appendChild(makeEl("label", {
      style: "display:block; font-weight:600; font-size:13px; margin-bottom:6px; color:var(--ink);"
    }, ["Gender *"]));
    const genderSelect = makeEl("select", {
      class: "input",
      style: "width:100%; padding:10px; font-size:14px;",
      id: "signUpGenderSelect"
    });
    genderSelect.appendChild(makeEl("option", { value: "" }, ["— Select Gender —"]));
    genderSelect.appendChild(makeEl("option", { value: "male" }, ["Male"]));
    genderSelect.appendChild(makeEl("option", { value: "female" }, ["Female"]));
    genderContainer.appendChild(genderSelect);
    fieldsContainer.appendChild(genderContainer);
    
    // Show/hide grade and gender based on role selection
    roleSelect.addEventListener("change", () => {
      if (roleSelect.value === "student") {
        gradeContainer.style.display = "block";
        genderContainer.style.display = "block";
        gradeInput.required = true;
        genderSelect.required = true;
      } else if (roleSelect.value === "teacher") {
        gradeContainer.style.display = "none";
        genderContainer.style.display = "block";
        gradeInput.required = false;
        genderSelect.required = true;
        gradeInput.value = "";
      } else {
        gradeContainer.style.display = "none";
        genderContainer.style.display = "none";
        gradeInput.required = false;
        genderSelect.required = false;
        gradeInput.value = "";
        genderSelect.value = "";
      }
    });
    
    modal.appendChild(fieldsContainer);
    
    // Buttons
    const buttonsDiv = makeEl("div", {
      style: "display:flex; gap:12px; justify-content:flex-end; margin-top:20px;"
    });
    
    const cancelBtn = makeEl("button", {
      class: "btn",
      style: "font-size:13px; padding:8px 16px; background:#f3f4f6; color:var(--ink); border:1px solid var(--grid-soft);",
      onclick: () => {
        document.body.removeChild(overlay);
        resolve(false);
      }
    }, ["Cancel"]);
    
    const registerBtn = makeEl("button", {
      class: "btn primary",
      style: "font-size:13px; padding:8px 16px;",
      onclick: () => {
        const email = emailInput.value.trim().toLowerCase();
        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        const phoneNumber = phoneInput.value.trim();
        const role = roleSelect.value;
        const grade = gradeInput.value.trim();
        const gender = genderSelect.value;
        
        // Validation
        if (!email) {
          showError("Email Required", "Please enter your email address.", "").then(() => {});
          return;
        }
        if (!isValidMICDSEmail(email)) {
          showError("Invalid Email", "Please enter a valid @micds.org email address.", "").then(() => {});
          return;
        }
        if (!firstName) {
          showError("First Name Required", "Please enter your first name.", "").then(() => {});
          return;
        }
        if (!lastName) {
          showError("Last Name Required", "Please enter your last name.", "").then(() => {});
          return;
        }
        if (!phoneNumber) {
          showError("Phone Required", "Please enter your phone number.", "").then(() => {});
          return;
        }
        if (!role) {
          showError("Role Required", "Please select your role.", "").then(() => {});
          return;
        }
        
        // Check if email already exists
        const existingRole = getUserRole(email);
        if (existingRole) {
          showError("Account Exists", "This email is already registered. Please use Sign In instead.", "").then(() => {});
          return;
        }
        
        // Role-specific validation
        if (role === "student") {
          if (!grade) {
            showError("Grade Required", "Please enter your grade level.", "").then(() => {});
            return;
          }
          if (!gender) {
            showError("Gender Required", "Please select your gender.", "").then(() => {});
            return;
          }
        } else if (role === "teacher") {
          if (!gender) {
            showError("Gender Required", "Please select your gender.", "").then(() => {});
            return;
          }
        }
        
        try {
          let genderValue = null;
          if (gender === "male") genderValue = "male";
          else if (gender === "female") genderValue = "female";
          
          // Combine first and last name
          const fullName = `${firstName} ${lastName}`.trim();
          
          if (role === "student") {
            addStudent(email, fullName, grade, genderValue);
            
            // Store phone number in student record
            const student = getStudent(email);
            if (student) {
              updateStudent(email, (r) => {
                r.phone = phoneNumber;
              });
            }
          } else if (role === "teacher") {
            addTeacher(email);
            
            // Store teacher info (name, phone, gender) in admin DB
            const db = loadAdminDB();
            if (!db.teacherInfo) db.teacherInfo = {};
            db.teacherInfo[email] = {
              name: fullName,
              phone: phoneNumber,
              gender: genderValue
            };
            saveAdminDB(db);
          }
          
          // Set default password for new users (they can change it later via forgot password)
          // Use a simple default: username + "123"
          const defaultPassword = email.split("@")[0] + "123";
          setUserPassword(email, defaultPassword);
          
          document.body.removeChild(overlay);
          resolve(true);
        } catch (err) {
          showError("Registration Failed", "Unable to complete registration.", err.message).then(() => {});
        }
      }
    }, ["Register"]);
    
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(registerBtn);
    modal.appendChild(buttonsDiv);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(false);
      }
    });
    
    // Focus email input
    setTimeout(() => emailInput.focus(), 100);
  });
}

// Helper function to show role selection modal (for existing login flow)
function showRoleSelectionModal(email) {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = makeEl("div", {
      id: "roleSelectionModalOverlay",
      style: "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center;"
    });
    
    // Create modal content
    const modal = makeEl("div", {
      id: "roleSelectionModal",
      style: "background:white; border-radius:12px; padding:24px; max-width:500px; width:90%; max-height:90vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.3);"
    });
    
    // Title
    modal.appendChild(makeEl("div", {
      style: "font-size:20px; font-weight:600; margin-bottom:20px; color:var(--ink);"
    }, ["Select Your Role"]));
    
    // Description
    modal.appendChild(makeEl("div", {
      style: "font-size:13px; color:var(--muted); margin-bottom:20px; line-height:1.6;"
    }, [`This email is not registered in the system. Please select your role to continue.`]));
    
    // Role buttons
    const rolesContainer = makeEl("div", {
      style: "display:flex; flex-direction:column; gap:12px; margin-bottom:20px;"
    });
    
    const studentBtn = makeEl("button", {
      class: "btn",
      style: "width:100%; padding:16px; text-align:left; font-size:15px; font-weight:600;",
      onclick: () => {
        document.body.removeChild(overlay);
        showStudentRegistrationModal(email).then(registered => {
          if (registered) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      }
    }, ["👤 Student - I am a student at MICDS"]);
    
    const teacherBtn = makeEl("button", {
      class: "btn",
      style: "width:100%; padding:16px; text-align:left; font-size:15px; font-weight:600;",
      onclick: () => {
        try {
          addTeacher(email);
          document.body.removeChild(overlay);
          resolve(true);
        } catch (err) {
          showError("Registration Failed", "Unable to register as teacher.", err.message).then(() => {});
        }
      }
    }, ["👨‍🏫 Teacher - I am a teacher at MICDS"]);
    
    const parentBtn = makeEl("button", {
      class: "btn",
      style: "width:100%; padding:16px; text-align:left; font-size:15px; font-weight:600;",
      onclick: () => {
        document.body.removeChild(overlay);
        showParentRegistrationModal(email).then(registered => {
          if (registered) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      }
    }, ["👨‍👩‍👧 Parent - I am a parent of MICDS students"]);
    
    rolesContainer.appendChild(studentBtn);
    rolesContainer.appendChild(teacherBtn);
    rolesContainer.appendChild(parentBtn);
    
    modal.appendChild(rolesContainer);
    
    // Cancel button
    const buttonsDiv = makeEl("div", {
      style: "display:flex; gap:12px; justify-content:flex-end; margin-top:20px;"
    });
    
    const cancelBtn = makeEl("button", {
      class: "btn",
      style: "font-size:13px; padding:8px 16px; background:#f3f4f6; color:var(--ink); border:1px solid var(--grid-soft);",
      onclick: () => {
        document.body.removeChild(overlay);
        resolve(false);
      }
    }, ["Cancel"]);
    
    buttonsDiv.appendChild(cancelBtn);
    modal.appendChild(buttonsDiv);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(false);
      }
    });
  });
}

// Helper function to show student registration modal
function showStudentRegistrationModal(studentEmail) {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = makeEl("div", {
      id: "studentRegistrationModalOverlay",
      style: "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center;"
    });
    
    // Create modal content
    const modal = makeEl("div", {
      id: "studentRegistrationModal",
      style: "background:white; border-radius:12px; padding:24px; max-width:500px; width:90%; max-height:90vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.3);"
    });
    
    // Title
    modal.appendChild(makeEl("div", {
      style: "font-size:20px; font-weight:600; margin-bottom:20px; color:var(--ink);"
    }, ["Student Registration"]));
    
    // Description
    modal.appendChild(makeEl("div", {
      style: "font-size:13px; color:var(--muted); margin-bottom:20px; line-height:1.6;"
    }, [`Please provide your information to complete registration.`]));
    
    // Fields
    const fieldsContainer = makeEl("div", {
      style: "display:flex; flex-direction:column; gap:16px; margin-bottom:20px;"
    });
    
    const firstNameInput = makeEl("input", {
      type: "text",
      class: "input",
      style: "padding:10px; font-size:14px;",
      placeholder: "John",
      id: "studentRegFirstName"
    });
    
    const lastNameInput = makeEl("input", {
      type: "text",
      class: "input",
      style: "padding:10px; font-size:14px;",
      placeholder: "Doe",
      id: "studentRegLastName"
    });
    
    const gradeInput = makeEl("input", {
      type: "text",
      class: "input",
      style: "padding:10px; font-size:14px;",
      placeholder: "6, 7, or 8",
      id: "studentRegGrade"
    });
    
    const genderSelect = makeEl("select", {
      class: "input",
      style: "padding:10px; font-size:14px;",
      id: "studentRegGender"
    });
    genderSelect.appendChild(makeEl("option", { value: "" }, ["— Select Gender —"]));
    genderSelect.appendChild(makeEl("option", { value: "male" }, ["Male"]));
    genderSelect.appendChild(makeEl("option", { value: "female" }, ["Female"]));
    
    fieldsContainer.appendChild(makeEl("div", {}, [
      makeEl("label", { style: "font-weight:600; font-size:13px; margin-bottom:6px; display:block;" }, ["First Name:"]),
      firstNameInput
    ]));
    
    fieldsContainer.appendChild(makeEl("div", {}, [
      makeEl("label", { style: "font-weight:600; font-size:13px; margin-bottom:6px; display:block;" }, ["Last Name:"]),
      lastNameInput
    ]));
    
    fieldsContainer.appendChild(makeEl("div", {}, [
      makeEl("label", { style: "font-weight:600; font-size:13px; margin-bottom:6px; display:block;" }, ["Grade Level:"]),
      gradeInput
    ]));
    
    fieldsContainer.appendChild(makeEl("div", {}, [
      makeEl("label", { style: "font-weight:600; font-size:13px; margin-bottom:6px; display:block;" }, ["Gender:"]),
      genderSelect
    ]));
    
    modal.appendChild(fieldsContainer);
    
    // Buttons
    const buttonsDiv = makeEl("div", {
      style: "display:flex; gap:12px; justify-content:flex-end; margin-top:20px;"
    });
    
    const cancelBtn = makeEl("button", {
      class: "btn",
      style: "font-size:13px; padding:8px 16px; background:#f3f4f6; color:var(--ink); border:1px solid var(--grid-soft);",
      onclick: () => {
        document.body.removeChild(overlay);
        resolve(false);
      }
    }, ["Cancel"]);
    
    const registerBtn = makeEl("button", {
      class: "btn primary",
      style: "font-size:13px; padding:8px 16px;",
      onclick: () => {
        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        const grade = gradeInput.value.trim();
        const gender = genderSelect.value;
        
        // Combine first and last name
        const fullName = (firstName && lastName) ? `${firstName} ${lastName}`.trim() : (firstName || lastName || null);
        
        let genderValue = null;
        if (gender === "male") genderValue = "male";
        else if (gender === "female") genderValue = "female";
        
        try {
          addStudent(studentEmail, fullName, grade || null, genderValue);
          document.body.removeChild(overlay);
          resolve(true);
        } catch (err) {
          showError("Registration Failed", "Unable to complete registration.", err.message).then(() => {});
        }
      }
    }, ["Register"]);
    
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(registerBtn);
    modal.appendChild(buttonsDiv);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(false);
      }
    });
    
    // Focus name input
    setTimeout(() => nameInput.focus(), 100);
  });
}

// Helper function to show parent registration modal
function showParentRegistrationModal(parentEmail) {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = makeEl("div", {
      id: "parentRegistrationModalOverlay",
      style: "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center;"
    });
    
    // Create modal content
    const modal = makeEl("div", {
      id: "parentRegistrationModal",
      style: "background:white; border-radius:12px; padding:24px; max-width:500px; width:90%; max-height:90vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.3);"
    });
    
    // Title
    modal.appendChild(makeEl("div", {
      style: "font-size:20px; font-weight:600; margin-bottom:20px; color:var(--ink);"
    }, ["Parent Registration"]));
    
    // Description
    modal.appendChild(makeEl("div", {
      style: "font-size:13px; color:var(--muted); margin-bottom:20px; line-height:1.6;"
    }, [`Welcome! You're logging in as a parent. Please enter the email addresses of your children who are students at MICDS.`]));
    
    // Children input section
    const childrenContainer = makeEl("div", {
      style: "display:flex; flex-direction:column; gap:12px; margin-bottom:20px;"
    });
    
    const childrenList = makeEl("div", {
      id: "parentChildrenList",
      style: "display:flex; flex-direction:column; gap:8px; max-height:200px; overflow-y:auto;"
    });
    
    const inputContainer = makeEl("div", {
      style: "display:flex; gap:8px;"
    });
    
    const childInput = makeEl("input", {
      type: "email",
      id: "parentChildEmailInput",
      class: "input",
      style: "flex:1; padding:8px; font-size:13px;",
      placeholder: "child.name@micds.org",
      onkeypress: (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const email = childInput.value.trim().toLowerCase();
          if (!email) return;
          if (!email.endsWith("@micds.org")) {
            showError("Invalid Email", "Student email must be a @micds.org address.", "").then(() => {});
            return;
          }
          
          // Check if already added
          const existing = Array.from(childrenList.querySelectorAll("div")).some(div => {
            const emailSpan = div.querySelector("span");
            return emailSpan && emailSpan.textContent.trim().toLowerCase() === email;
          });
          
          if (existing) {
            showError("Duplicate Email", "This student is already in the list.", "").then(() => {});
            return;
          }
          
          // Add to list
          const childItem = makeEl("div", {
            style: "display:flex; align-items:center; justify-content:space-between; padding:8px; background:#f9fafb; border:1px solid var(--grid-soft); border-radius:6px;"
          });
          childItem.appendChild(makeEl("span", {
            style: "flex:1;"
          }, [email]));
          const removeBtn = makeEl("button", {
            style: "background:none; border:none; color:var(--red); cursor:pointer; font-size:18px; padding:0 4px;",
            onclick: () => {
              childItem.remove();
            }
          }, ["×"]);
          childItem.appendChild(removeBtn);
          childrenList.appendChild(childItem);
          childInput.value = "";
        }
      }
    });
    
    const addBtn = makeEl("button", {
      class: "btn",
      style: "font-size:12px; padding:8px 16px;",
      onclick: () => {
        const email = childInput.value.trim().toLowerCase();
        if (!email) return;
        if (!email.endsWith("@micds.org")) {
          showError("Invalid Email", "Student email must be a @micds.org address.", "").then(() => {});
          return;
        }
        
        // Check if already added
        const existing = Array.from(childrenList.querySelectorAll("div")).some(div => {
          const emailSpan = div.querySelector("span");
          return emailSpan && emailSpan.textContent.trim().toLowerCase() === email;
        });
        
        if (existing) {
          showError("Duplicate Email", "This student is already in the list.", "").then(() => {});
          return;
        }
        
        // Add to list
        const childItem = makeEl("div", {
          style: "display:flex; align-items:center; justify-content:space-between; padding:8px; background:#f9fafb; border:1px solid var(--grid-soft); border-radius:6px;"
        });
        childItem.appendChild(makeEl("span", {
          style: "flex:1;"
        }, [email]));
        const removeBtn = makeEl("button", {
          style: "background:none; border:none; color:var(--red); cursor:pointer; font-size:18px; padding:0 4px;",
          onclick: () => {
            childItem.remove();
          }
        }, ["×"]);
        childItem.appendChild(removeBtn);
        childrenList.appendChild(childItem);
        childInput.value = "";
      }
    }, ["Add"]);
    
    inputContainer.appendChild(childInput);
    inputContainer.appendChild(addBtn);
    
    childrenContainer.appendChild(makeEl("div", {
      style: "font-weight:600; font-size:13px; margin-bottom:8px;"
    }, ["Children's Email Addresses:"]));
    childrenContainer.appendChild(childrenList);
    childrenContainer.appendChild(inputContainer);
    
    modal.appendChild(childrenContainer);
    
    // Buttons
    const buttonsDiv = makeEl("div", {
      style: "display:flex; gap:12px; justify-content:flex-end; margin-top:20px;"
    });
    
    const cancelBtn = makeEl("button", {
      class: "btn",
      style: "font-size:13px; padding:8px 16px; background:#f3f4f6; color:var(--ink); border:1px solid var(--grid-soft);",
      onclick: () => {
        document.body.removeChild(overlay);
        resolve(false);
      }
    }, ["Cancel"]);
    
    const registerBtn = makeEl("button", {
      class: "btn primary",
      style: "font-size:13px; padding:8px 16px;",
      onclick: () => {
        const childrenItems = Array.from(childrenList.querySelectorAll("div"));
        const childrenEmails = childrenItems.map(item => {
          const emailSpan = item.querySelector("span");
          return emailSpan ? emailSpan.textContent.trim().toLowerCase() : null;
        }).filter(email => email);
        
        if (childrenEmails.length === 0) {
          showError("No Children Added", "Please add at least one child's email address.", "").then(() => {});
          return;
        }
        
        try {
          addParent(parentEmail, childrenEmails);
          document.body.removeChild(overlay);
          resolve(true);
        } catch (err) {
          showError("Registration Failed", "Unable to complete registration.", err.message).then(() => {});
        }
      }
    }, ["Register"]);
    
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(registerBtn);
    modal.appendChild(buttonsDiv);
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(false);
      }
    });
    
    // Focus input
    setTimeout(() => childInput.focus(), 100);
  });
}

// Helper function to show add student modal with auto-fill feature
function showAddStudentModal(prefillEmail = "", onComplete = null) {
  const autoFillEnabled = state.autoFillStudentInfo;
  const lastGrade = state.lastStudentGrade || "";
  const lastGender = state.lastStudentGender || "";
  
  // Create modal overlay
  const overlay = makeEl("div", {
    id: "addStudentModalOverlay",
    style: "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center;"
  });
  
  // Create modal content
  const modal = makeEl("div", {
    id: "addStudentModal",
    style: "background:white; border-radius:12px; padding:24px; max-width:500px; width:90%; max-height:90vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.3);"
  });
  
  // Title
  modal.appendChild(makeEl("div", {
    style: "font-size:20px; font-weight:600; margin-bottom:20px; color:var(--ink);"
  }, ["Add New Student"]));
  
  // Auto-fill toggle
  const toggleContainer = makeEl("div", {
    style: "display:flex; align-items:center; gap:8px; margin-bottom:16px; padding:12px; background:#f9fafb; border-radius:8px; border:1px solid var(--grid-soft);"
  });
  
  const toggleCheckbox = makeEl("input", {
    type: "checkbox",
    id: "autoFillToggle",
    checked: autoFillEnabled,
    style: "width:18px; height:18px; cursor:pointer;"
  });
  
  const toggleLabel = makeEl("label", {
    for: "autoFillToggle",
    style: "font-weight:600; font-size:13px; color:var(--ink); cursor:pointer; flex:1; display:flex; align-items:center; gap:6px;"
  });
  
  const toggleText = makeEl("span", {}, ["Remember Grade & Gender"]);
  const infoIconContainer = makeEl("span", {
    style: "position:relative; display:inline-block;"
  });
  const infoIcon = makeEl("span", {
    style: "cursor:help; font-size:14px; color:var(--blue);"
  }, ["ℹ️"]);
  
  // Tooltip container
  const tooltip = makeEl("div", {
    style: "display:none; position:absolute; bottom:100%; left:50%; transform:translateX(-50%); margin-bottom:8px; padding:8px 12px; background:#1f2937; color:white; border-radius:6px; font-size:11px; white-space:normal; z-index:10001; max-width:280px; width:280px; box-shadow:0 4px 12px rgba(0,0,0,0.3); pointer-events:none;"
  }, ["When enabled, the grade and gender fields will automatically fill with the values from your last student entry. This helps speed up adding multiple students with the same information."]);
  
  infoIcon.addEventListener("mouseenter", () => {
    tooltip.style.display = "block";
  });
  
  infoIcon.addEventListener("mouseleave", () => {
    tooltip.style.display = "none";
  });
  
  infoIconContainer.appendChild(infoIcon);
  infoIconContainer.appendChild(tooltip);
  toggleLabel.appendChild(toggleText);
  toggleLabel.appendChild(infoIconContainer);
  
  toggleContainer.appendChild(toggleCheckbox);
  toggleContainer.appendChild(toggleLabel);
  modal.appendChild(toggleContainer);
  
  // Fields container
  const fieldsContainer = makeEl("div", {
    style: "display:flex; flex-direction:column; gap:16px; margin-bottom:20px;"
  });
  
  // Email field
  const emailDiv = makeEl("div", {
    style: "display:flex; flex-direction:column; gap:6px;"
  });
  emailDiv.appendChild(makeEl("label", {
    style: "font-weight:600; font-size:13px; color:var(--ink);"
  }, ["Email *"]));
  const emailInput = makeEl("input", {
    type: "email",
    class: "input",
    style: "padding:10px; font-size:14px;",
    value: prefillEmail,
    placeholder: "student@micds.org",
    required: true
  });
  emailDiv.appendChild(emailInput);
  emailDiv.appendChild(makeEl("div", {
    style: "font-size:11px; color:var(--muted);"
  }, ["Must be a @micds.org email address"]));
  fieldsContainer.appendChild(emailDiv);
  
  // First Name field
  const firstNameDiv = makeEl("div", {
    style: "display:flex; flex-direction:column; gap:6px;"
  });
  firstNameDiv.appendChild(makeEl("label", {
    style: "font-weight:600; font-size:13px; color:var(--ink);"
  }, ["First Name"]));
  const firstNameInput = makeEl("input", {
    type: "text",
    class: "input",
    style: "padding:10px; font-size:14px;",
    value: "",
    placeholder: "John"
  });
  firstNameDiv.appendChild(firstNameInput);
  firstNameDiv.appendChild(makeEl("div", {
    style: "font-size:11px; color:var(--muted);"
  }, ["Student's first name"]));
  fieldsContainer.appendChild(firstNameDiv);
  
  // Last Name field
  const lastNameDiv = makeEl("div", {
    style: "display:flex; flex-direction:column; gap:6px;"
  });
  lastNameDiv.appendChild(makeEl("label", {
    style: "font-weight:600; font-size:13px; color:var(--ink);"
  }, ["Last Name"]));
  const lastNameInput = makeEl("input", {
    type: "text",
    class: "input",
    style: "padding:10px; font-size:14px;",
    value: "",
    placeholder: "Doe"
  });
  lastNameDiv.appendChild(lastNameInput);
  lastNameDiv.appendChild(makeEl("div", {
    style: "font-size:11px; color:var(--muted);"
  }, ["Student's last name"]));
  fieldsContainer.appendChild(lastNameDiv);
  
  // Grade field
  const gradeDiv = makeEl("div", {
    style: "display:flex; flex-direction:column; gap:6px;"
  });
  gradeDiv.appendChild(makeEl("label", {
    style: "font-weight:600; font-size:13px; color:var(--ink);"
  }, ["Grade Level"]));
  const gradeInput = makeEl("input", {
    type: "text",
    class: "input",
    style: "padding:10px; font-size:14px;",
    value: autoFillEnabled ? lastGrade : "",
    placeholder: "6, 7, 8, etc."
  });
  gradeDiv.appendChild(gradeInput);
  gradeDiv.appendChild(makeEl("div", {
    style: "font-size:11px; color:var(--muted);"
  }, ["Student's grade level"]));
  fieldsContainer.appendChild(gradeDiv);
  
  // Gender field
  const genderDiv = makeEl("div", {
    style: "display:flex; flex-direction:column; gap:6px;"
  });
  genderDiv.appendChild(makeEl("label", {
    style: "font-weight:600; font-size:13px; color:var(--ink);"
  }, ["Gender"]));
  const genderSelect = makeEl("select", {
    class: "input",
    style: "padding:10px; font-size:14px;"
  });
  const genderOptions = [
    { value: "", label: "— Select —" },
    { value: "male", label: "Male" },
    { value: "female", label: "Female" }
  ];
  genderOptions.forEach(opt => {
    const option = makeEl("option", { value: opt.value }, [opt.label]);
    if (autoFillEnabled && opt.value === lastGender) option.selected = true;
    genderSelect.appendChild(option);
  });
  genderDiv.appendChild(genderSelect);
  genderDiv.appendChild(makeEl("div", {
    style: "font-size:11px; color:var(--muted);"
  }, ["Student's gender"]));
  fieldsContainer.appendChild(genderDiv);
  
  modal.appendChild(fieldsContainer);
  
  // Buttons
  const buttonsDiv = makeEl("div", {
    style: "display:flex; gap:12px; justify-content:flex-end; margin-top:20px;"
  });
  
  const cancelBtn = makeEl("button", {
    class: "btn",
    style: "font-size:13px; padding:8px 16px; background:#f3f4f6; color:var(--ink); border:1px solid var(--grid-soft);",
    onclick: () => {
      document.body.removeChild(overlay);
    }
  }, ["Cancel"]);
  
  const saveBtn = makeEl("button", {
    class: "btn",
    style: "font-size:13px; padding:8px 16px;",
      onclick: () => {
      const email = emailInput.value.trim();
      const firstName = firstNameInput.value.trim();
      const lastName = lastNameInput.value.trim();
      const grade = gradeInput.value.trim();
      const gender = genderSelect.value;
      
      // Validate email
      if (!email) {
        showError("Email Required", "Please enter a student email address.", "The email must be a valid @micds.org address.").then(() => {});
        return;
      }
      
      // Update auto-fill state
      state.autoFillStudentInfo = toggleCheckbox.checked;
      if (grade) state.lastStudentGrade = grade;
      if (gender) state.lastStudentGender = gender;
      
      // Process gender value
      let genderValue = null;
      if (gender === "male") genderValue = "male";
      else if (gender === "female") genderValue = "female";
      
      // Combine first and last name
      const nameValue = (firstName && lastName) ? `${firstName} ${lastName}`.trim() : (firstName || lastName || null);
      const gradeValue = grade || null;
      
      try {
        addStudent(email, nameValue, gradeValue, genderValue);
        setStatus(`Added student: ${email}${nameValue ? ` (${nameValue})` : ""}`);
        document.body.removeChild(overlay);
        if (onComplete) onComplete(email, nameValue, gradeValue, genderValue);
        render();
      } catch (err) {
        showError("Operation Failed", "Unable to add student.", err.message).then(() => {});
      }
    }
  }, ["Save"]);
  
  buttonsDiv.appendChild(cancelBtn);
  buttonsDiv.appendChild(saveBtn);
  modal.appendChild(buttonsDiv);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
  
  // Focus first name input
  setTimeout(() => firstNameInput.focus(), 100);
}

// Helper function to create and show an edit modal
function showEditModal(title, fields, onSave, onCancel = null){
  // Create modal overlay
  const overlay = makeEl("div", {
    id: "editModalOverlay",
    style: "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center;"
  });
  
  // Create modal content
  const modal = makeEl("div", {
    id: "editModal",
    style: "background:white; border-radius:12px; padding:24px; max-width:500px; width:90%; max-height:90vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.3);"
  });
  
  // Title
  modal.appendChild(makeEl("div", {
    style: "font-size:20px; font-weight:600; margin-bottom:20px; color:var(--ink);"
  }, [title]));
  
  // Fields list
  const fieldsContainer = makeEl("div", {
    style: "display:flex; flex-direction:column; gap:16px; margin-bottom:20px;"
  });
  
  const fieldInputs = {};
  fields.forEach(field => {
    const fieldDiv = makeEl("div", {
      style: "display:flex; flex-direction:column; gap:6px;"
    });
    
    fieldDiv.appendChild(makeEl("label", {
      style: "font-weight:600; font-size:13px; color:var(--ink);"
    }, [field.label + (field.required ? " *" : "")]));
    
    let input;
    if (field.type === "select") {
      input = makeEl("select", {
        class: "input",
        style: "padding:10px; font-size:14px;",
        required: field.required || false
      });
      field.options.forEach(opt => {
        const option = makeEl("option", { value: opt.value }, [opt.label]);
        if (opt.value === field.value) option.selected = true;
        input.appendChild(option);
      });
    } else {
      input = makeEl("input", {
        type: field.type || "text",
        class: "input",
        style: "padding:10px; font-size:14px;",
        value: field.value || "",
        placeholder: field.placeholder || "",
        required: field.required || false
      });
    }
    
    fieldInputs[field.key] = input;
    fieldDiv.appendChild(input);
    
    if (field.help) {
      fieldDiv.appendChild(makeEl("div", {
        style: "font-size:11px; color:var(--muted);"
      }, [field.help]));
    }
    
    fieldsContainer.appendChild(fieldDiv);
  });
  
  modal.appendChild(fieldsContainer);
  
  // Buttons
  const buttonsDiv = makeEl("div", {
    style: "display:flex; gap:12px; justify-content:flex-end; margin-top:20px;"
  });
  
  const cancelBtn = makeEl("button", {
    class: "btn",
    style: "font-size:13px; padding:8px 16px; background:#f3f4f6; color:var(--ink); border:1px solid var(--grid-soft);",
    onclick: () => {
      document.body.removeChild(overlay);
      if (onCancel) onCancel();
    }
  }, ["Cancel"]);
  
  const saveBtn = makeEl("button", {
    class: "btn",
    style: "font-size:13px; padding:8px 16px;",
    onclick: () => {
      const values = {};
      for (const key in fieldInputs) {
        values[key] = fieldInputs[key].value.trim();
      }
      onSave(values);
      document.body.removeChild(overlay);
    }
  }, ["Save"]);
  
  buttonsDiv.appendChild(cancelBtn);
  buttonsDiv.appendChild(saveBtn);
  modal.appendChild(buttonsDiv);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
      if (onCancel) onCancel();
    }
  });
  
  // Focus first input
  if (fields.length > 0 && fieldInputs[fields[0].key]) {
    setTimeout(() => fieldInputs[fields[0].key].focus(), 100);
  }
}

function isValidMICDSEmail(email){
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  return trimmed.endsWith("@micds.org");
}

// Helper function to show polished error messages with custom modal
function showError(title, message, details = null) {
  return new Promise((resolve) => {
    // Remove any existing error modal
    const existing = document.getElementById("errorModalOverlay");
    if (existing) existing.remove();
    
    // Create modal overlay
    const overlay = makeEl("div", {
      id: "errorModalOverlay",
      style: "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s ease;"
    });
    
    // Create modal content
    const modal = makeEl("div", {
      id: "errorModal",
      style: "background:white; border-radius:16px; padding:0; max-width:500px; width:90%; max-height:90vh; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.3); animation:slideUp 0.3s ease;"
    });
    
    // Header with icon
    const header = makeEl("div", {
      style: "background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding:24px; color:white;"
    }, [
      makeEl("div", {
        style: "display:flex; align-items:center; gap:12px;"
      }, [
        makeEl("div", {
          style: "width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:24px;"
        }, ["⚠️"]),
        makeEl("div", {
          style: "font-size:20px; font-weight:700; flex:1;"
        }, [title])
      ])
    ]);
    
    // Body
    const body = makeEl("div", {
      style: "padding:24px;"
    });
    
    body.appendChild(makeEl("div", {
      style: "font-size:15px; color:var(--ink); line-height:1.6; margin-bottom:12px;"
    }, [message]));
    
    if (details) {
      body.appendChild(makeEl("div", {
        style: "font-size:13px; color:var(--muted); line-height:1.5; padding:12px; background:#f9fafb; border-radius:8px; border:1px solid var(--grid-soft); white-space:pre-wrap;"
      }, [details]));
    }
    
    // Footer with button
    const footer = makeEl("div", {
      style: "padding:16px 24px; border-top:1px solid var(--grid-soft); display:flex; justify-content:flex-end;"
    });
    
    const okButton = makeEl("button", {
      class: "btn primary",
      style: "padding:10px 24px; font-size:15px; font-weight:600;",
      onclick: () => {
        overlay.remove();
        resolve();
      }
    }, ["OK"]);
    
    footer.appendChild(okButton);
    
    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve();
      }
    });
    
    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === "Escape") {
        overlay.remove();
        document.removeEventListener("keydown", escapeHandler);
        resolve();
      }
    };
    document.addEventListener("keydown", escapeHandler);
    
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Focus the button
    setTimeout(() => okButton.focus(), 100);
  });
}

// Helper function to show polished confirmation messages with custom modal
function showConfirm(title, message, details = null) {
  return new Promise((resolve) => {
    // Remove any existing confirm modal
    const existing = document.getElementById("confirmModalOverlay");
    if (existing) existing.remove();
    
    // Create modal overlay
    const overlay = makeEl("div", {
      id: "confirmModalOverlay",
      style: "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center; animation:fadeIn 0.2s ease;"
    });
    
    // Create modal content
    const modal = makeEl("div", {
      id: "confirmModal",
      style: "background:white; border-radius:16px; padding:0; max-width:500px; width:90%; max-height:90vh; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.3); animation:slideUp 0.3s ease;"
    });
    
    // Header with icon
    const header = makeEl("div", {
      style: "background:linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); padding:24px; color:white;"
    }, [
      makeEl("div", {
        style: "display:flex; align-items:center; gap:12px;"
      }, [
        makeEl("div", {
          style: "width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:24px;"
        }, ["❓"]),
        makeEl("div", {
          style: "font-size:20px; font-weight:700; flex:1;"
        }, [title])
      ])
    ]);
    
    // Body
    const body = makeEl("div", {
      style: "padding:24px;"
    });
    
    body.appendChild(makeEl("div", {
      style: "font-size:15px; color:var(--ink); line-height:1.6; margin-bottom:12px;"
    }, [message]));
    
    if (details) {
      body.appendChild(makeEl("div", {
        style: "font-size:13px; color:var(--muted); line-height:1.5; padding:12px; background:#f9fafb; border-radius:8px; border:1px solid var(--grid-soft); white-space:pre-wrap;"
      }, [details]));
    }
    
    // Footer with buttons
    const footer = makeEl("div", {
      style: "padding:16px 24px; border-top:1px solid var(--grid-soft); display:flex; justify-content:flex-end; gap:12px;"
    });
    
    const cancelButton = makeEl("button", {
      class: "btn",
      style: "padding:10px 24px; font-size:15px; font-weight:600;",
      onclick: () => {
        overlay.remove();
        resolve(false);
      }
    }, ["Cancel"]);
    
    const confirmButton = makeEl("button", {
      class: "btn primary",
      style: "padding:10px 24px; font-size:15px; font-weight:600;",
      onclick: () => {
        overlay.remove();
        resolve(true);
      }
    }, ["Confirm"]);
    
    footer.appendChild(cancelButton);
    footer.appendChild(confirmButton);
    
    // Close on overlay click
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
    
    // Close on Escape key
    const escapeHandler = (e) => {
      if (e.key === "Escape") {
        overlay.remove();
        document.removeEventListener("keydown", escapeHandler);
        resolve(false);
      }
    };
    document.addEventListener("keydown", escapeHandler);
    
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Focus the confirm button
    setTimeout(() => confirmButton.focus(), 100);
  });
}

// Helper function to check if a student matches a class's requirements
function checkStudentClassMatch(studentEmail, className){
  const student = getStudent(studentEmail);
  const classData = loadClasses();
  const cls = classData.classes[className];
  
  if (!student || !cls) return { match: true, errors: [] };
  
  const errors = [];
  
  // Check grade level match
  if (cls.gradeLevel && student.grade) {
    if (student.grade !== cls.gradeLevel) {
      errors.push(`Grade mismatch: Student is grade ${student.grade}, class is grade ${cls.gradeLevel}`);
    }
  }
  
  // Check gender match
  if (cls.gender && student.gender) {
    if (cls.gender === "all-girls" && student.gender !== "female") {
      errors.push(`Gender mismatch: Student is ${student.gender}, class is all-girls`);
    } else if (cls.gender === "all-boys" && student.gender !== "male") {
      errors.push(`Gender mismatch: Student is ${student.gender}, class is all-boys`);
    }
  }
  
  return {
    match: errors.length === 0,
    errors: errors
  };
}

// Helper function to filter classes that a student can join
function getCompatibleClasses(studentEmail) {
  const student = getStudent(studentEmail);
  const teacherEmail = state.loggedInUser;
  const isAdmin = state.userRole === "admin";
  const isTeacher = state.userRole === "teacher";
  const isStudent = state.userRole === "student";
  
  // For admins, get all classes; for teachers, get only their classes; for students, get all classes
  let availableClasses;
  if (isAdmin) {
    availableClasses = getAllClasses();
  } else if (isTeacher) {
    availableClasses = teacherEmail ? getClassesForTeacher(teacherEmail) : [];
  } else if (isStudent) {
    // Students can see all classes (they can add themselves or others to compatible classes)
    availableClasses = getAllClasses();
  } else {
    // Fallback: if role is unclear, get all classes
    availableClasses = getAllClasses();
  }
  
  if (!student) return availableClasses;
  
  // Filter to only classes that match the student's grade and gender
  return availableClasses.filter(cls => {
    const check = checkStudentClassMatch(studentEmail, cls.name);
    return check.match;
  });
}

// Helper function to check if a student is assigned to any class
function isStudentAssignedToClass(studentEmail) {
  const classData = loadClasses();
  const studentClasses = classData.studentClasses?.[studentEmail] || [];
  return studentClasses.length > 0;
}

// Helper function to check if a teacher is assigned to any class
function isTeacherAssignedToClass(teacherEmail) {
  const classes = getClassesForTeacher(teacherEmail);
  return classes.length > 0;
}

// Helper function to check if current user is assigned (for students and teachers)
function isCurrentUserAssigned() {
  if (state.userRole === "student") {
    return isStudentAssignedToClass(state.loggedInUser);
  } else if (state.userRole === "teacher") {
    return isTeacherAssignedToClass(state.loggedInUser);
  }
  // Admins and parents are always considered "assigned"
  return true;
}

// Helper function to render "not assigned" message
function renderNotAssignedMessage() {
  const isStudent = state.userRole === "student";
  const message = isStudent 
    ? "You are registered as a student but have not been assigned to any classes yet. Please contact an administrator to be assigned to a class."
    : "You are registered as a teacher but have not been assigned to any classes yet. Please contact an administrator to be assigned to a class.";
  
  return makeEl("div", { class:"card", style:"padding:24px; text-align:center;" }, [
    makeEl("div", { style:"font-size:24px; margin-bottom:16px;" }, ["🔒"]),
    makeEl("div", { class:"sectionTitle", style:"margin-bottom:12px; font-size:18px;" }, [
      isStudent ? "Not Assigned to Any Classes" : "No Classes Assigned"
    ]),
    makeEl("div", { class:"muted", style:"font-size:14px; line-height:1.6; max-width:500px; margin:0 auto;" }, [message])
  ]);
}

// Helper function to get all mismatched students in a class
function getMismatchedStudentsInClass(className){
  const classData = loadClasses();
  const cls = classData.classes[className];
  if (!cls || !cls.students) return [];
  
  const mismatched = [];
  cls.students.forEach(studentEmail => {
    const check = checkStudentClassMatch(studentEmail, className);
    if (!check.match) {
      const student = getStudent(studentEmail);
      mismatched.push({
        email: studentEmail,
        name: student?.name || studentEmail,
        errors: check.errors
      });
    }
  });
  
  return mismatched;
}

function isAdminEmail(email){
  return (email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

function isTeacherEmail(email){
  return TEACHER_EMAILS.includes((email || "").trim().toLowerCase());
}

function isStudentEmail(email){
  return STUDENT_EMAILS.includes((email || "").trim().toLowerCase());
}

function getUserRole(email){
  // Use storage function which checks admin DB
  return getUserRoleFromStorage(email);
}

function showLoginPage(){
  const loginPage = $("loginPage");
  const mainApp = $("mainApp");
  if (loginPage) loginPage.style.display = "flex";
  if (mainApp) mainApp.style.display = "none";
}

function showMainApp(){
  const loginPage = $("loginPage");
  const mainApp = $("mainApp");
  if (loginPage) loginPage.style.display = "none";
  if (mainApp) mainApp.style.display = "block";
}

function handleLogin(email, password){
  console.log("handleLogin called with:", email);
  
  // Clear previous errors first
  const emailError = $("emailError");
  const passwordError = $("passwordError");
  const loginError = $("loginError");
  if (emailError) {
    emailError.textContent = "";
    emailError.style.display = "none";
  }
  if (passwordError) {
    passwordError.textContent = "";
    passwordError.style.display = "none";
  }
  if (loginError) {
    loginError.textContent = "";
    loginError.style.display = "none";
  }
  
  // Validate email format and domain
  if (!isValidMICDSEmail(email)){
    console.log("Invalid email format");
    if (emailError) {
      emailError.textContent = "Please enter a valid @micds.org email address";
      emailError.style.display = "block";
    }
    return false;
  }
  
  // Check if user is in the system
  const userRole = getUserRole(email);
  if (!userRole){
    console.log("User not found in system");
    if (loginError) {
      loginError.textContent = "This email is not registered in the system. Please try again or sign up for a new account.";
      loginError.style.display = "block";
    }
    return false;
  }
  
  // Check if user has a password set
  if (!hasPassword(email)) {
    // If no password set, set it to the provided password (first time login)
    setUserPassword(email, password);
  } else {
    // Verify password
    if (!verifyUserPassword(email, password)) {
      if (passwordError) {
        passwordError.textContent = "Incorrect password. Please try again.";
        passwordError.style.display = "block";
      }
      return false;
    }
  }
  
  return completeLogin(email, userRole);
}

function completeLogin(email, userRole){
  // Set state
  state.loggedInUser = email.trim().toLowerCase();
  state.userRole = userRole;
  state.isTeacher = userRole === "teacher" || userRole === "admin";
  
  // Save to sessionStorage
  sessionStorage.setItem("loggedInUser", state.loggedInUser);
  sessionStorage.setItem("userRole", state.userRole);
  sessionStorage.setItem("isTeacher", String(state.isTeacher));
  
  // Show main app
  showMainApp();
  
  // For students, auto-load their own data
  if (userRole === "student"){
    state.email = state.loggedInUser;
    ensureStudent(state.email);
  }
  
  // For parents, set up to show their children
  if (userRole === "parent"){
    const children = getParentChildren(state.loggedInUser);
    if (children.length > 0) {
      // Auto-select first child
      state.email = children[0];
      ensureStudent(state.email);
    }
  }
  
  // Initialize app
  initTopbar();
  refreshRosterUI();
  buildTabs();
  render();
  setStatus(`Logged in as ${userRole}: ${state.loggedInUser}`);
  
  return true;
}

function handleLogout(){
  state.loggedInUser = null;
  state.userRole = null;
  state.isTeacher = false;
  state.email = "";
  state.activeTab = "scores";
  
  sessionStorage.removeItem("loggedInUser");
  sessionStorage.removeItem("userRole");
  sessionStorage.removeItem("isTeacher");
  
  showLoginPage();
  
  // Clear form
  const loginForm = $("loginForm");
  if (loginForm) loginForm.reset();
  
  const emailError = $("emailError");
  const loginError = $("loginError");
  if (emailError) emailError.textContent = "";
  if (loginError) loginError.textContent = "";
}

function initLogin(){
  const loginForm = $("loginForm");
  if (!loginForm) {
    console.error("Login form not found! Make sure the page has loaded.");
    // Try again after a short delay
    setTimeout(() => {
      const retryForm = $("loginForm");
      if (retryForm) {
        console.log("Login form found on retry");
        initLogin();
      } else {
        console.error("Login form still not found after retry");
      }
    }, 500);
    return;
  }
  
  // Check if already initialized
  if (loginForm.dataset.initialized === "true") {
    console.log("Login form already initialized");
    return;
  }
  loginForm.dataset.initialized = "true";
  
  const handleSubmit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log("Login form submitted");
    
      const emailInput = $("loginEmail");
      const passwordInput = $("loginPassword");
      
      if (!emailInput) {
        console.error("Email input not found!");
        showError("Login Error", "The email input field could not be found.", "Please refresh the page and try again.");
        return;
      }
      
      if (!passwordInput) {
        console.error("Password input not found!");
        showError("Login Error", "The password input field could not be found.", "Please refresh the page and try again.");
        return;
      }
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      console.log("Email entered:", email);
      
      // Clear previous errors
      const emailError = $("emailError");
      const passwordError = $("passwordError");
      const loginError = $("loginError");
      if (emailError) {
        emailError.textContent = "";
        emailError.style.display = "none";
      }
      if (passwordError) {
        passwordError.textContent = "";
        passwordError.style.display = "none";
      }
      if (loginError) {
        loginError.textContent = "";
        loginError.style.display = "none";
      }
      
      if (!email){
        console.log("No email entered");
        if (emailError) {
          emailError.textContent = "Please enter your email address";
          emailError.style.display = "block";
        }
        return;
      }
      
      if (!password){
        console.log("No password entered");
        if (passwordError) {
          passwordError.textContent = "Please enter your password";
          passwordError.style.display = "block";
        }
        return;
      }
      
      console.log("Attempting login with:", email);
      const result = handleLogin(email, password);
      console.log("Login result:", result);
      if (!result) {
        console.log("Login failed");
      }
  };
  
  loginForm.addEventListener("submit", handleSubmit);
  
  // Also add click handler to button as fallback
  const loginButton = loginForm.querySelector("button[type='submit']");
  if (loginButton) {
    loginButton.addEventListener("click", (e) => {
      e.preventDefault();
      handleSubmit(e);
    });
  }
  
  // Sign Up link handler
  const signUpLink = $("signUpLink");
  if (signUpLink) {
    signUpLink.addEventListener("click", (e) => {
      e.preventDefault();
      showSignUpRoleSelectionModal().then(signedUp => {
        if (signedUp) {
          // After successful sign up, show success message
          const loginError = $("loginError");
          if (loginError) {
            loginError.textContent = "Account created successfully! Your default password is your username + '123'. Please sign in or use 'Forgot password?' to set a new password.";
            loginError.style.display = "block";
            loginError.style.color = "green";
            setTimeout(() => {
              loginError.textContent = "";
              loginError.style.display = "none";
              loginError.style.color = "";
            }, 8000);
          }
        }
      });
    });
    
    // Add hover effect
    signUpLink.addEventListener("mouseenter", () => {
      signUpLink.style.textDecoration = "underline";
    });
    signUpLink.addEventListener("mouseleave", () => {
      signUpLink.style.textDecoration = "none";
    });
  }
  
  // Real-time email validation
  const emailInput = $("loginEmail");
  if (emailInput){
    emailInput.addEventListener("input", () => {
      const emailError = $("emailError");
      if (emailError) {
        const email = emailInput.value.trim();
        if (email && !isValidMICDSEmail(email)){
          emailError.textContent = "Email must end with @micds.org";
          emailError.style.display = "block";
        } else {
          emailError.textContent = "";
          emailError.style.display = "none";
        }
      }
    });
  }
  
  // Forgot Password link handler
  const forgotPasswordLink = $("forgotPasswordLink");
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      showForgotPasswordModal();
    });
    
    // Add hover effect
    forgotPasswordLink.addEventListener("mouseenter", () => {
      forgotPasswordLink.style.textDecoration = "underline";
    });
    forgotPasswordLink.addEventListener("mouseleave", () => {
      forgotPasswordLink.style.textDecoration = "none";
    });
  }
  
  // Demo login buttons
  const demoLogin = (email, role) => {
    seedDemoData();
    completeLogin(email, role);
  };
  const demoStudentBtn = $("demoStudentBtn");
  if (demoStudentBtn) demoStudentBtn.addEventListener("click", () => demoLogin("alex.johnson@micds.org", "student"));
  const demoTeacherBtn = $("demoTeacherBtn");
  if (demoTeacherBtn) demoTeacherBtn.addEventListener("click", () => demoLogin("prosen@micds.org", "teacher"));
  const demoAdminBtn = $("demoAdminBtn");
  if (demoAdminBtn) demoAdminBtn.addEventListener("click", () => demoLogin("admin@micds.org", "admin"));

  console.log("Login form initialized successfully");
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

function checkHonorCodeForStudent(){
  if (state.isTeacher) return true; // Teachers don't need honor code
  if (!state.email) return false;
  const record = getStudent(state.email);
  return !!record?.honorCode;
}

// Track which teacher score dropdowns are open (by unique key)
const openTeacherDropdowns = new Set();

function scoreSelect(value, onChange, requireHonorCode = false, uniqueKey = null, disabled = false){
  const isTeacher = state.isTeacher || state.userRole === "teacher" || state.userRole === "admin";
  
  if (isTeacher){
    // If disabled, just show badge (read-only)
    if (disabled) {
      return badge(value);
    }
    
    // Generate unique key if not provided (use timestamp + random)
    const dropdownKey = uniqueKey || `dropdown-${Date.now()}-${Math.random()}`;
    const wasOpen = openTeacherDropdowns.has(dropdownKey);
    
    // For teachers: create badge-styled dropdown that doesn't auto-close
    const container = makeEl("div", { 
      class: "teacherScoreContainer",
      "data-dropdown-key": dropdownKey,
      style: "position:relative; width:100%;"
    });
    
    // Track current value for immediate UI updates
    let currentValue = value;
    let isOpen = wasOpen; // Restore previous open state
    
    // Options container (styled as badges - same format as student display)
    const optionsContainer = makeEl("div", {
      class: "teacherScoreOptions",
      style: `${isOpen ? "display:flex;" : "display:none;"} flex-direction:column; gap:6px; margin-top:6px;`
    });
    
    // Add arrow indicator to show it's clickable
    const arrow = makeEl("span", {
      style: "margin-left:6px; font-size:10px; opacity:0.7;"
    }, [isOpen ? "▲" : "▼"]);
    
    // Update arrow when toggling
    const updateArrow = () => {
      arrow.textContent = isOpen ? "▲" : "▼";
    };
    
    // Display current value as badge (clickable to toggle)
    const displayBadge = makeEl("div", {
      class: `badge ${currentValue ? scoreBadgeClass(currentValue) : ""}`,
      style: "display:inline-flex; align-items:center; justify-content:center; min-width:50px; cursor:pointer; user-select:none; transition:all 0.2s ease; position:relative;",
      onclick: (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        if (isOpen) {
          openTeacherDropdowns.add(dropdownKey);
        } else {
          openTeacherDropdowns.delete(dropdownKey);
        }
        optionsContainer.style.display = isOpen ? "flex" : "none";
        updateArrow();
      }
    });
    
    // Set initial content with arrow
    displayBadge.textContent = currentValue === null ? "—" : String(currentValue);
    displayBadge.appendChild(arrow);
    
    // Function to update display badge and button states
    const updateDisplay = () => {
      // Update badge text (preserve arrow)
      const badgeText = displayBadge.firstChild;
      if (badgeText && badgeText.nodeType === Node.TEXT_NODE) {
        badgeText.textContent = currentValue === null ? "—" : String(currentValue);
      }
      displayBadge.className = `badge ${currentValue ? scoreBadgeClass(currentValue) : ""}`;
      
      // Update button states
      dashOption.style.opacity = currentValue === null ? "0.7" : "1";
      dashOption.style.transform = currentValue === null ? "scale(0.95)" : "scale(1)";
      scoreButtons.forEach((btn, idx) => {
        const score = SCORE_LEVELS[idx];
        btn.style.opacity = currentValue === score ? "0.7" : "1";
        btn.style.transform = currentValue === score ? "scale(0.95)" : "scale(1)";
      });
    };
    
    // Add "—" option
    const dashOption = makeEl("button", {
      type: "button",
      class: "badge",
      style: "width:100%; text-align:center; cursor:pointer; border:1px solid var(--grid-soft); background:#f9fafb; color:var(--muted); padding:8px 12px; transition:all 0.2s ease;",
      onclick: (e) => {
        e.stopPropagation(); // Prevent event from bubbling to close handler
        currentValue = null;
        updateDisplay();
        onChange(null);
        // Keep dropdown open - don't change isOpen state
        // The dropdown will stay open because we don't remove it from openTeacherDropdowns
      }
    }, ["—"]);
    optionsContainer.appendChild(dashOption);
    
    // Add score options (1-4) with badge styling (exact same format as student badges)
    const scoreButtons = [];
    for (const n of SCORE_LEVELS){
      const scoreOption = makeEl("button", {
        type: "button",
        class: `badge ${scoreBadgeClass(n)}`,
        style: "width:100%; text-align:center; cursor:pointer; padding:8px 12px; transition:all 0.2s ease;",
        onclick: (e) => {
          e.stopPropagation(); // Prevent event from bubbling to close handler
          currentValue = n;
          updateDisplay();
          onChange(n);
          // Keep dropdown open - don't change isOpen state
          // The dropdown will stay open because we don't remove it from openTeacherDropdowns
        }
      }, [String(n)]);
      scoreButtons.push(scoreOption);
      optionsContainer.appendChild(scoreOption);
    }
    
    // Initialize display
    updateDisplay();
    
    container.appendChild(displayBadge);
    container.appendChild(optionsContainer);
    return container;
  } else {
    // For students: if disabled, just show badge (read-only)
    if (disabled) {
      return badge(value);
    }
    
    // For students: normal dropdown behavior
  const sel = makeEl("select", { class: "selectScore" });
  sel.appendChild(new Option("—", ""));
  for (const n of SCORE_LEVELS){
    sel.appendChild(new Option(String(n), String(n)));
  }
  sel.value = (value ?? "") === null ? "" : String(value ?? "");
    
    sel.addEventListener("change", () => {
      // Check honor code if required (for students entering their own scores)
      if (requireHonorCode && !checkHonorCodeForStudent()){
        showConfirm("Honor Code Required", "You must check the honor code box to proceed.", "Please read and accept the honor code before entering your self-ratings. Click Confirm to automatically check the honor code box.").then(confirmed => {
          if (confirmed) {
            // Automatically check the honor code box
            if (state.email) {
              setHonorCode(state.email, true);
              // Update the checkbox in the UI if it exists
              const checkbox = $("honorCodeDashboard");
              if (checkbox) {
                checkbox.checked = true;
              }
              render();
              // Now proceed with the change
              onChange(sel.value === "" ? null : Number(sel.value));
            }
          } else {
            // Reset to original value if user cancels
            sel.value = (value ?? "") === null ? "" : String(value ?? "");
          }
        });
        return;
      }
      onChange(sel.value === "" ? null : Number(sel.value));
    });
    
  return sel;
  }
}

function badge(n){
  if (!n) return makeEl("span", { class:"badge" }, ["—"]);
  return makeEl("span", { class:`badge ${scoreBadgeClass(n)}` }, [`${n}`]);
}

function refreshRosterUI(){
  // No longer needed - header removed
}

function buildTabs(){
  const tabs = $("tabs");
  tabs.innerHTML = "";

  const addFuturePlansTab = () => {
    tabs.appendChild(makeEl("button", {
      class: `tab ${state.activeTab === "futurePlans" ? "active" : ""}`,
      onclick: () => { state.activeTab = "futurePlans"; render(); }
    }, ["Future Plans"]));
  };

  // If student or teacher is not assigned, don't show any tabs
  if (!isCurrentUserAssigned() && (state.userRole === "student" || state.userRole === "teacher")) {
    return;
  }
  
  // Admin view: show admin tab and all students tab
  if (state.userRole === "admin"){
    const adminTab = makeEl("button", {
      class: `tab ${state.activeTab === "admin" ? "active" : ""}`,
      onclick: () => { state.activeTab = "admin"; render(); }
    }, ["Admin Panel"]);
    tabs.appendChild(adminTab);
    
    const allStudentsTab = TABS.find(t => t.id === "allStudents");
    if (allStudentsTab) {
      const el = makeEl("button", {
        class: `tab ${state.activeTab === allStudentsTab.id ? "active" : ""}`,
        onclick: () => { state.activeTab = allStudentsTab.id; render(); }
      }, [allStudentsTab.label]);
      tabs.appendChild(el);
    }
    addFuturePlansTab();
    return;
  }

  // Teacher view, only show "All Students" tab
  if (state.isTeacher || state.userRole === "teacher") {
    const allStudentsTab = TABS.find(t => t.id === "allStudents");
    if (allStudentsTab) {
      const el = makeEl("button", {
        class: `tab ${state.activeTab === allStudentsTab.id ? "active" : ""}`,
        onclick: () => { state.activeTab = allStudentsTab.id; render(); }
      }, [allStudentsTab.label]);
      tabs.appendChild(el);
    }
    addFuturePlansTab();
    return;
  }

  // Parent view: show children selector and standard tabs
  if (state.userRole === "parent") {
    // Show tabs for standards (same as student view)
    for (const t of TABS){
      if (t.teacherOnly || t.id === "allStudents") continue;

      const el = makeEl("button", {
        class: `tab ${state.activeTab === t.id ? "active" : ""}`,
        onclick: () => { state.activeTab = t.id; render(); }
      }, [t.label]);
      tabs.appendChild(el);
    }
    addFuturePlansTab();
    return;
  }
  
  // In student view, show all tabs except teacher-only ones and "All Students"
  for (const t of TABS){
    if (t.teacherOnly || t.id === "allStudents") continue;
    
    const el = makeEl("button", {
      class: `tab ${state.activeTab === t.id ? "active" : ""}`,
      onclick: () => { state.activeTab = t.id; render(); }
    }, [t.label]);
    tabs.appendChild(el);
  }
}

function loadOrCreate(){
  let email = "";
  
  if (state.isTeacher || state.userRole === "teacher" || state.userRole === "admin"){
    // For teachers: they need to select a student from the All Students tab
    setStatus("Please select a student from the 'All Students' tab.");
    return;
  } else {
    // For students: use their logged-in email
    email = state.loggedInUser;
  }
  
  if (!email){
    setStatus("Enter/select a student first.");
    return;
  }
  
  const isNew = !getStudent(email);
  ensureStudent(email);
  state.email = email;
  
  refreshRosterUI();
  setStatus(`${isNew ? "Created" : "Loaded"}: ${email} • Mode: ${state.isTeacher ? "Teacher" : "Student"}`);
  render();
}

function handleExport(){
  const blob = new Blob([exportJSON()], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "micds-assessment-backup.json";
  a.click();
  URL.revokeObjectURL(url);
  setStatus("Backup saved successfully.");
}

function handleImport(){
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
    const text = await file.text();
    importJSON(text);
    refreshRosterUI();
      setStatus("Backup loaded successfully.");
    render();
    } catch (err) {
      setStatus("Error: Invalid backup file. " + err.message);
      showError("Invalid Backup File", "The file you selected is not a valid backup file.", err.message);
    }
  };
  input.click();
}


function updateUIForRole(){
  // No longer needed - header removed
}

function initTopbar(){
  // Set up settings icon with dropdown
  const settingsButton = $("settingsButton");
  const settingsDropdown = $("settingsDropdown");
  const btnLogout = $("btnLogout");
  
  if (settingsButton && settingsDropdown) {
    // Toggle dropdown on click
    settingsButton.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = settingsDropdown.style.display !== "none";
      settingsDropdown.style.display = isVisible ? "none" : "block";
    });
    
    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!settingsButton.contains(e.target) && !settingsDropdown.contains(e.target)) {
        settingsDropdown.style.display = "none";
      }
    });
  }
  
  if (btnLogout) {
    btnLogout.addEventListener("click", handleLogout);
  }
}

function computeClassAverages(){
  const allStudents = getAllStudents();
  if (!allStudents.length) return null;
  
  const averages = {
    overall: [],
    s1: [],
    s2: [],
    s3: [],
    s4: []
  };
  
  for (const student of allStudents){
    const overall = computeOverallGrade(student);
    if (overall !== null) averages.overall.push(overall);
    
    const s1 = computeStandardAverage(RUBRIC.s1, student);
    if (s1 !== null) averages.s1.push(s1);
    
    const s2 = computeStandardAverage(RUBRIC.s2, student);
    if (s2 !== null) averages.s2.push(s2);
    
    const s3 = computeStandardAverage(RUBRIC.s3, student);
    if (s3 !== null) averages.s3.push(s3);
    
    const s4 = computeStandardAverage(RUBRIC.s4, student);
    if (s4 !== null) averages.s4.push(s4);
  }
  
  return {
    overall: averages.overall.length ? averages.overall.reduce((a,b)=>a+b,0) / averages.overall.length : null,
    s1: averages.s1.length ? averages.s1.reduce((a,b)=>a+b,0) / averages.s1.length : null,
    s2: averages.s2.length ? averages.s2.reduce((a,b)=>a+b,0) / averages.s2.length : null,
    s3: averages.s3.length ? averages.s3.reduce((a,b)=>a+b,0) / averages.s3.length : null,
    s4: averages.s4.length ? averages.s4.reduce((a,b)=>a+b,0) / averages.s4.length : null,
    count: allStudents.length
  };
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
  const classAvgs = computeClassAverages();

  // Parent view: show child selector
  const parentChildSelector = state.userRole === "parent" ? (() => {
    const children = getParentChildren(state.loggedInUser);
    if (children.length === 0) {
      return makeEl("div", { class:"card", style:"margin-bottom:14px; padding:14px; background:#fff3cd; border:1px solid #ffc107;" }, [
        makeEl("div", { style:"font-weight:600; margin-bottom:8px;" }, ["No Children Registered"]),
        makeEl("div", { class:"muted", style:"font-size:13px;" }, ["You don't have any children registered. Please contact an administrator."])
      ]);
    }
    
    const section = makeEl("div", { class:"card", style:"margin-bottom:14px; padding:14px;" });
    section.appendChild(makeEl("div", { class:"sectionTitle", style:"font-size:14px; margin-bottom:8px;" }, ["Select Child"]));
    
    const select = makeEl("select", {
      class: "control",
      style: "width:100%; margin-bottom:8px;",
      onchange: (e) => {
        const selectedEmail = e.target.value;
        if (selectedEmail) {
          state.email = selectedEmail;
          ensureStudent(selectedEmail);
          render();
        }
      }
    });
    
    select.appendChild(makeEl("option", { value: "" }, ["— Select a child —"]));
    children.forEach(childEmail => {
      const student = getStudent(childEmail);
      const displayName = student?.name || childEmail.replace("@micds.org", "");
      const option = makeEl("option", { 
        value: childEmail,
        selected: state.email === childEmail
      }, [`${displayName} (${childEmail})`]);
      select.appendChild(option);
    });
    
    section.appendChild(select);
    return section;
  })() : null;

  // Honor code checkbox (for students, shown in dashboard)
  const honorCodeSection = !state.isTeacher && state.userRole !== "parent" ? (() => {
    const section = makeEl("div", { class:"card", style:"margin-bottom:14px; padding:14px;" });
    section.appendChild(makeEl("div", { class:"sectionTitle", style:"font-size:14px; margin-bottom:8px;" }, ["Honor Code"]));
    
    const label = makeEl("label", { class:"toggle", style:"display:flex; align-items:center; gap:8px; cursor:pointer; padding:8px;" });
    const checkbox = makeEl("input", { type: "checkbox", id: "honorCodeDashboard" });
    checkbox.checked = !!record?.honorCode;
    checkbox.addEventListener("change", (e) => {
      if (!state.email) return;
      setHonorCode(state.email, e.target.checked);
      render();
    });
    label.appendChild(checkbox);
    label.appendChild(makeEl("span", { style:"font-weight:600;" }, ["I agree to the Honor Code"]));
    section.appendChild(label);
    section.appendChild(makeEl("div", { class:"muted", style:"margin-top:8px; font-size:12px;" }, [
      "You must check this box before entering your ratings or notes."
    ]));
    return section;
  })() : null;

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
        makeEl("div", { class:"muted" }, [state.isTeacher ? "Student honor code status" : "Check the box below to enable rating entry"])
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

  const rightChildren = [
    makeEl("div", { class:"sectionTitle" }, [state.isTeacher ? "Teacher Dashboard (Population)" : "Class Snapshot (Read-only)"]),
    makeEl("div", { class:"muted" }, [
      state.isTeacher
        ? "Counts use effective scores (Teacher overrides Student)."
        : "Teacher view shows full dashboard with class statistics."
    ])
  ];
  
  // Add class averages for teachers
  if (state.isTeacher && classAvgs && classAvgs.count > 0){
    rightChildren.push(
      makeEl("div", { class:"card", style:"margin-top:12px; background:#f9fafb;" }, [
        makeEl("div", { class:"sectionTitle", style:"font-size:14px;" }, ["Class Averages"]),
        makeEl("div", { class:"kpiRow" }, [
          makeEl("div", { class:"kpi", style:"background:#fff;" }, [
            makeEl("div", { class:"label", style:"font-size:11px;" }, ["Overall"]),
            makeEl("div", { class:"value", style:"font-size:20px;" }, [classAvgs.overall !== null ? classAvgs.overall.toFixed(2) : "—"])
          ]),
          makeEl("div", { class:"kpi", style:"background:#fff;" }, [
            makeEl("div", { class:"label", style:"font-size:11px;" }, [`Students: ${classAvgs.count}`]),
            makeEl("div", { class:"value", style:"font-size:20px;" }, [""])
          ])
        ]),
        makeEl("div", { class:"kpiRow", style:"margin-top:8px;" }, [
          makeEl("div", { class:"kpi", style:"background:#fff;" }, [
            makeEl("div", { class:"label", style:"font-size:11px;" }, ["Std 1"]),
            makeEl("div", { class:"value", style:"font-size:18px;" }, [classAvgs.s1 !== null ? classAvgs.s1.toFixed(2) : "—"])
          ]),
          makeEl("div", { class:"kpi", style:"background:#fff;" }, [
            makeEl("div", { class:"label", style:"font-size:11px;" }, ["Std 2"]),
            makeEl("div", { class:"value", style:"font-size:18px;" }, [classAvgs.s2 !== null ? classAvgs.s2.toFixed(2) : "—"])
          ]),
          makeEl("div", { class:"kpi", style:"background:#fff;" }, [
            makeEl("div", { class:"label", style:"font-size:11px;" }, ["Std 3"]),
            makeEl("div", { class:"value", style:"font-size:18px;" }, [classAvgs.s3 !== null ? classAvgs.s3.toFixed(2) : "—"])
          ]),
          makeEl("div", { class:"kpi", style:"background:#fff;" }, [
            makeEl("div", { class:"label", style:"font-size:11px;" }, ["Std 4"]),
            makeEl("div", { class:"value", style:"font-size:18px;" }, [classAvgs.s4 !== null ? classAvgs.s4.toFixed(2) : "—"])
          ])
        ])
      ])
    );
  }
  
  rightChildren.push(
    makeEl("div", { class:"canvasWrap", style:"margin-top:10px;" }, [
      (() => {
        const c = document.createElement("canvas");
        c.width = 420; c.height = 260;
        drawDonutCounts(c, popCounts, "Population score distribution (All Standards)");
        return c;
      })()
    ])
  );
  
  const right = makeEl("div", { class:"card" }, rightChildren);

  // Wrap left column with honor code section for students and child selector for parents
  const leftColumn = makeEl("div", {}, [
    parentChildSelector,
    honorCodeSection,
    left
  ].filter(x => x !== null));

  return makeEl("div", { class:"grid2" }, [leftColumn, right]);
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
      }, true, null, state.isTeacher) // Disable for teachers - only students can edit their own scores
    ]);

    const teacherCell = makeEl("div", { class:"cellStack" }, [
      badge(teacherVal),
      scoreSelect(teacherVal, (v) => {
        if (!state.email) return;
        updateStudent(state.email, (r) => { r.teacher.scores[it.key] = v; });
        render();
      }, false, `${state.email}-${it.key}`, !state.isTeacher) // Disable for students - only teachers can edit teacher scores
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
          // Check honor code for students entering proofs
          if (!state.isTeacher && !checkHonorCodeForStudent()){
            const currentValue = ta.value;
            showConfirm("Honor Code Required", "You must check the honor code box to proceed.", "Please read and accept the honor code before entering your self-ratings. Click Confirm to automatically check the honor code box.").then(confirmed => {
              if (confirmed) {
                // Automatically check the honor code box
                setHonorCode(state.email, true);
                // Update the checkbox in the UI if it exists
                const checkbox = $("honorCodeDashboard");
                if (checkbox) {
                  checkbox.checked = true;
                }
                render();
                // Now proceed with the update
                updateStudent(state.email, (r) => { r.student.proofs[it.key] = currentValue; });
              } else {
                // Reset to original value if user cancels
                ta.value = studentProof;
              }
            });
            ta.value = studentProof; // Reset to original value temporarily
            return;
          }
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
        // Check honor code for students
        if (!state.isTeacher && !checkHonorCodeForStudent()){
          const currentValue = input.value;
          showConfirm("Honor Code Required", "You must check the honor code box to proceed.", "Please read and accept the honor code before entering your self-ratings. Click Confirm to automatically check the honor code box.").then(confirmed => {
            if (confirmed) {
              // Automatically check the honor code box
              setHonorCode(state.email, true);
              // Update the checkbox in the UI if it exists
              const checkbox = $("honorCodeDashboard");
              if (checkbox) {
                checkbox.checked = true;
              }
              render();
              // Now proceed with the update
              updateStudent(state.email, (r) => { r.student.scores[it.key] = Number(currentValue || 0); });
              render();
            } else {
              // Reset to original value if user cancels
              input.value = String(atlVal);
            }
          });
          input.value = String(atlVal); // Reset to original value temporarily
          return;
        }
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

// Render admin sub-tabs
function renderAdminSubTabs(){
  const tabsContainer = makeEl("div", {
    style: "display:flex; gap:8px; margin-bottom:20px; border-bottom:2px solid var(--grid-soft);"
  });
  
  const tabs = [
    { id: "students", label: "👨‍🎓 Students" },
    { id: "teachers", label: "👨‍🏫 Teachers" },
    { id: "classes", label: "📚 Classes" }
  ];
  
  tabs.forEach(tab => {
    const tabEl = makeEl("button", {
      class: "btn",
      style: `padding:10px 20px; border:none; border-bottom:3px solid ${state.adminSubTab === tab.id ? "var(--blue)" : "transparent"}; background:${state.adminSubTab === tab.id ? "#f0f7ff" : "transparent"}; color:${state.adminSubTab === tab.id ? "var(--blue)" : "var(--ink)"}; font-weight:${state.adminSubTab === tab.id ? "600" : "400"}; cursor:pointer; transition:all 0.2s;`,
      onclick: () => {
        state.adminSubTab = tab.id;
        render();
      }
    }, [tab.label]);
    tabsContainer.appendChild(tabEl);
  });
  
  return tabsContainer;
}

// Render Teachers Management Section
function renderAdminTeachers(){
  const teachers = getAllTeachers();
  const classes = getAllClasses();
  
  return makeEl("div", { class:"card", style:"margin-bottom:24px;" }, [
    makeEl("div", { 
      style:"display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;" 
    }, [
      makeEl("div", { class:"sectionTitle", style:"margin:0; font-size:18px;" }, ["👨‍🏫 Teachers Management"]),
      makeEl("button", {
        class: "btn",
        style: "font-size:12px; padding:6px 12px;",
        onclick: () => {
          showEditModal("Add New Teacher", [
            {
              key: "email",
              label: "Email",
              type: "email",
              value: "",
              placeholder: "teacher@micds.org",
              required: true,
              help: "Must be a @micds.org email address"
            },
            {
              key: "firstName",
              label: "First Name",
              type: "text",
              value: "",
              placeholder: "John",
              help: "Teacher's first name"
            },
            {
              key: "lastName",
              label: "Last Name",
              type: "text",
              value: "",
              placeholder: "Doe",
              help: "Teacher's last name"
            },
            {
              key: "phone",
              label: "Phone Number",
              type: "tel",
              value: "",
              placeholder: "(314) 555-1234",
              help: "Phone number (optional)"
            },
            {
              key: "gender",
              label: "Gender",
              type: "select",
              value: "",
              options: [
                { value: "", label: "— Select —" },
                { value: "male", label: "Male" },
                { value: "female", label: "Female" }
              ],
              help: "Teacher's gender (optional)"
            }
          ], (values) => {
            try {
              const email = values.email.trim().toLowerCase();
              if (!email || !isValidMICDSEmail(email)) {
                showError("Invalid Email", "Please enter a valid @micds.org email address.", "").then(() => {});
                return;
              }
              
              // Add teacher
              addTeacher(email);
              
              // Combine first and last name
              const fullName = (values.firstName?.trim() && values.lastName?.trim()) 
                ? `${values.firstName.trim()} ${values.lastName.trim()}`.trim()
                : (values.firstName?.trim() || values.lastName?.trim() || null);
              
              // Store teacher info (name, phone, gender) in admin DB
              const db = loadAdminDB();
              if (!db.teacherInfo) db.teacherInfo = {};
              let genderValue = null;
              if (values.gender === "male") genderValue = "male";
              else if (values.gender === "female") genderValue = "female";
              
              db.teacherInfo[email] = {
                name: fullName,
                phone: values.phone?.trim() || null,
                gender: genderValue
              };
              saveAdminDB(db);
              
              // Set default password
              const defaultPassword = email.split("@")[0] + "123";
              setUserPassword(email, defaultPassword);
              
              setStatus(`Added teacher: ${email}`);
              render();
            } catch (err) {
              showError("Operation Failed", "Unable to complete the operation.", err.message).then(() => {});
            }
          });
        }
      }, ["➕ Add Teacher"])
    ]),
    makeEl("div", { style:"margin-top:12px;" }, [
      teachers.length === 0 
        ? makeEl("div", { class:"muted", style:"padding:12px; text-align:center;" }, ["No teachers added yet"])
        : makeEl("div", { style:"display:flex; flex-direction:column; gap:8px;" }, 
            teachers.map(teacherEmail => {
              const teacherClasses = classes.filter(c => c.teacherEmail === teacherEmail);
              return makeEl("div", {
                key: teacherEmail,
                style:"padding:12px; background:#f9fafb; border:1px solid var(--grid-soft); border-radius:8px; display:flex; justify-content:space-between; align-items:center;"
              }, [
                makeEl("div", { style:"flex:1;" }, [
                  makeEl("div", { style:"font-weight:600; margin-bottom:4px;" }, [teacherEmail]),
                  makeEl("div", { class:"muted", style:"font-size:12px;" }, [
                    `${teacherClasses.length} class${teacherClasses.length !== 1 ? "es" : ""}: ${teacherClasses.map(c => c.name).join(", ") || "None"}`
                  ])
                ]),
                makeEl("div", { style:"display:flex; gap:8px;" }, [
                  makeEl("button", {
                    class: "btn",
                    style: "font-size:11px; padding:4px 8px;",
                    onclick: () => {
                      showEditModal("Edit Teacher", [
                        {
                          key: "email",
                          label: "Email",
                          type: "email",
                          value: teacherEmail,
                          placeholder: "teacher@micds.org",
                          required: true,
                          help: "Must be a @micds.org email address"
                        }
                      ], (values) => {
                        if (values.email && values.email !== teacherEmail) {
                          try {
                            updateTeacherEmail(teacherEmail, values.email);
                            setStatus(`Updated teacher: ${teacherEmail} → ${values.email}`);
                            render();
                          } catch (err) {
                            showError("Operation Failed", "Unable to complete the operation.", err.message);
                          }
                        }
                      });
                    }
                  }, ["✏️ Edit"]),
                  makeEl("button", {
                    class: "btn danger-outline",
                    style: "font-size:11px; padding:4px 8px;",
                    onclick: () => {
                      showConfirm("Delete Teacher", `Are you sure you want to delete teacher "${teacherEmail}"?`, "This will remove them from all classes. This action cannot be undone.").then(confirmed => {
                        if (!confirmed) return;
                        try {
                          // Remove teacher from all classes first
                          classes.forEach(cls => {
                            if (cls.teacherEmail === teacherEmail) {
                              removeClass(cls.name);
                            }
                          });
                          removeTeacher(teacherEmail);
                          setStatus(`Deleted teacher: ${teacherEmail}`);
                          render();
                        } catch (err) {
                          showError("Operation Failed", "Unable to complete the operation.", err.message).then(() => {});
                        }
                      });
                    }
                  }, ["🗑️ Delete"])
                ])
              ]);
            })
          )
    ])
  ]);
}

// Render Students Management Section  
function renderAdminStudents(){
  const students = getAllAssignedStudents();
  
  return makeEl("div", { class:"card", style:"margin-bottom:24px;" }, [
    makeEl("div", { 
      style:"display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;" 
    }, [
      makeEl("div", { class:"sectionTitle", style:"margin:0; font-size:18px;" }, ["👨‍🎓 Students Management"]),
      makeEl("button", {
        class: "btn",
        style: "font-size:12px; padding:6px 12px;",
        onclick: () => {
          showAddStudentModal();
        }
      }, ["➕ Add Student"])
    ]),
    makeEl("div", { style:"margin-top:12px; max-height:400px; overflow-y:auto;" }, [
      students.length === 0 
        ? makeEl("div", { class:"muted", style:"padding:12px; text-align:center;" }, ["No students added yet"])
        : makeEl("div", { style:"display:flex; flex-direction:column; gap:8px;" }, 
            students.map(studentEmail => {
              const classData = loadClasses();
              const studentClasses = classData.studentClasses?.[studentEmail] || [];
              const studentRecord = getStudent(studentEmail);
              const studentName = studentRecord?.name || "—";
              const studentGrade = studentRecord?.grade || "—";
              const studentGender = studentRecord?.gender || "—";
              const genderDisplay = studentGender === "male" ? "👦 Male" : studentGender === "female" ? "👧 Female" : "—";
              
              return makeEl("div", {
                key: studentEmail,
                style:"padding:12px; background:#f9fafb; border:1px solid var(--grid-soft); border-radius:8px; display:flex; justify-content:space-between; align-items:center;"
              }, [
                makeEl("div", { style:"flex:1;" }, [
                  makeEl("div", { style:"font-weight:600; margin-bottom:4px;" }, [
                    `${studentName} (${studentEmail})`
                  ]),
                  makeEl("div", { class:"muted", style:"font-size:12px; margin-bottom:2px;" }, [
                    `Grade: ${studentGrade} | Gender: ${genderDisplay}`
                  ]),
                  makeEl("div", { class:"muted", style:"font-size:12px;" }, [
                    `${studentClasses.length} class${studentClasses.length !== 1 ? "es" : ""}: ${studentClasses.join(", ") || "None"}`
                  ])
                ]),
                makeEl("div", { style:"display:flex; gap:8px;" }, [
                  makeEl("button", {
                    class: "btn",
                    style: "font-size:11px; padding:4px 8px;",
                    onclick: () => {
                      const currentName = studentRecord?.name || "";
                      const currentGrade = studentRecord?.grade || "";
                      const currentGender = studentRecord?.gender || "";
                      
                      // Split current name into first and last
                      let firstName = "";
                      let lastName = "";
                      if (currentName) {
                        const nameParts = currentName.trim().split(/\s+/);
                        if (nameParts.length > 1) {
                          lastName = nameParts.pop();
                          firstName = nameParts.join(" ");
                        } else {
                          firstName = nameParts[0] || "";
                        }
                      }
                      
                      showEditModal("Edit Student", [
                        {
                          key: "email",
                          label: "Email",
                          type: "email",
                          value: studentEmail,
                          placeholder: "student@micds.org",
                          required: true,
                          help: "Must be a @micds.org email address"
                        },
                        {
                          key: "firstName",
                          label: "First Name",
                          type: "text",
                          value: firstName,
                          placeholder: "John",
                          help: "Student's first name"
                        },
                        {
                          key: "lastName",
                          label: "Last Name",
                          type: "text",
                          value: lastName,
                          placeholder: "Doe",
                          help: "Student's last name"
                        },
                        {
                          key: "grade",
                          label: "Grade Level",
                          type: "text",
                          value: currentGrade,
                          placeholder: "6, 7, 8, etc.",
                          help: "Student's grade level"
                        },
                        {
                          key: "gender",
                          label: "Gender",
                          type: "select",
                          value: currentGender,
                          options: [
                            { value: "", label: "— Select —" },
                            { value: "male", label: "Male" },
                            { value: "female", label: "Female" }
                          ],
                          help: "Student's gender"
                        }
                      ], (values) => {
                        try {
                          let genderValue = null;
                          if (values.gender === "male") genderValue = "male";
                          else if (values.gender === "female") genderValue = "female";
                          
                          // Combine first and last name
                          const fullName = (values.firstName?.trim() && values.lastName?.trim()) 
                            ? `${values.firstName.trim()} ${values.lastName.trim()}`.trim()
                            : (values.firstName?.trim() || values.lastName?.trim() || null);
                          
                          // Update email if changed
                          if (values.email && values.email !== studentEmail) {
                            updateStudentEmail(studentEmail, values.email);
                            // Update other fields with new email
                            updateStudentInfo(values.email, fullName, values.grade || null, genderValue);
                            setStatus(`Updated student: ${studentEmail} → ${values.email}`);
                          } else {
                            // Just update other fields
                            updateStudentInfo(studentEmail, fullName, values.grade || null, genderValue);
                            setStatus(`Updated student: ${studentEmail}`);
                          }
                          render();
                        } catch (err) {
                          showError("Operation Failed", "Unable to complete the operation.", err.message);
                        }
                      });
                    }
                  }, ["✏️ Edit"]),
                  makeEl("button", {
                    class: "btn danger-outline",
                    style: "font-size:11px; padding:4px 8px;",
                    onclick: () => {
                      showConfirm("Delete Student", `Are you sure you want to delete student "${studentEmail}"?`, "This will remove them from all classes. This action cannot be undone.").then(confirmed => {
                        if (!confirmed) return;
                        try {
                          // Remove student from all classes first
                          const classData = loadClasses();
                          if (classData.studentClasses?.[studentEmail]) {
                            classData.studentClasses[studentEmail].forEach(className => {
                              removeStudentFromClass(studentEmail, className);
                            });
                          }
                          removeStudent(studentEmail);
                          setStatus(`Deleted student: ${studentEmail}`);
                          render();
                        } catch (err) {
                          showError("Operation Failed", "Unable to complete the operation.", err.message).then(() => {});
                        }
                      });
                    }
                  }, ["🗑️ Delete"])
                ])
              ]);
            })
          )
    ])
  ]);
}

// Helper function to show rotation order setup modal
function showRotationOrderModal() {
  const classes = getAllClasses();
  const rotationOrders = loadRotationOrders();
  
  // Group classes by grade and gender
  const classesByGroup = {};
  classes.forEach(cls => {
    const grade = cls.gradeLevel || "mixed";
    const gender = cls.gender === "all-girls" ? "girls" : cls.gender === "all-boys" ? "boys" : "mixed";
    const key = `${grade}-${gender}`;
    if (!classesByGroup[key]) {
      classesByGroup[key] = {
        grade,
        gender,
        classes: []
      };
    }
    classesByGroup[key].classes.push(cls);
  });
  
  // Create modal overlay
  const overlay = makeEl("div", {
    id: "rotationOrderModalOverlay",
    style: "position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center;"
  });
  
  // Create modal content
  const modal = makeEl("div", {
    id: "rotationOrderModal",
    style: "background:white; border-radius:12px; padding:24px; max-width:700px; width:90%; max-height:90vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.3);"
  });
  
  // Title
  modal.appendChild(makeEl("div", {
    style: "font-size:20px; font-weight:600; margin-bottom:20px; color:var(--ink);"
  }, ["Set Rotation Orders"]));
  
  // Description
  modal.appendChild(makeEl("div", {
    style: "font-size:13px; color:var(--muted); margin-bottom:20px; line-height:1.6;"
  }, ["Set the rotation order for each grade and gender combination. Enter class names one by one, pressing Enter after each. Classes will rotate in the order you specify."]));
  
  const groupsContainer = makeEl("div", {
    style: "display:flex; flex-direction:column; gap:20px;"
  });
  
  // Create a section for each grade/gender combination
  Object.keys(classesByGroup).sort().forEach(key => {
    const group = classesByGroup[key];
    const gradeLabel = group.grade === "mixed" ? "Mixed Grade" : `Grade ${group.grade}`;
    const genderLabel = group.gender === "girls" ? "Girls" : group.gender === "boys" ? "Boys" : "Mixed";
    const groupKey = getRotationOrderKey(group.grade, group.gender === "girls" ? "all-girls" : group.gender === "boys" ? "all-boys" : null);
    let currentOrder = rotationOrders[groupKey] || [];
    
    const groupSection = makeEl("div", {
      style: "padding:16px; background:#f9fafb; border-radius:8px; border:1px solid var(--grid-soft);"
    });
    
    groupSection.appendChild(makeEl("div", {
      style: "font-weight:600; font-size:14px; margin-bottom:12px; color:var(--ink);"
    }, [`${gradeLabel} - ${genderLabel}`]));
    
    // Numbered list container
    const listContainer = makeEl("div", {
      id: `rotationList-${key}`,
      style: "display:flex; flex-direction:column; gap:8px; margin-bottom:12px;"
    });
    
    // Add existing items
    const classItems = [];
    currentOrder.forEach((className, index) => {
      const itemDiv = makeEl("div", {
        style: "display:flex; align-items:center; gap:8px; padding:8px; background:white; border:1px solid var(--grid-soft); border-radius:6px;"
      });
      itemDiv.appendChild(makeEl("span", {
        style: "font-weight:600; color:var(--muted); min-width:24px;"
      }, [`${index + 1}.`]));
      itemDiv.appendChild(makeEl("span", {
        style: "flex:1;"
      }, [className]));
        const removeBtn = makeEl("button", {
          style: "background:none; border:none; color:var(--red); cursor:pointer; font-size:18px; padding:0 4px;",
          onclick: () => {
            itemDiv.remove();
            updateRotationList();
          }
        }, ["×"]);
      itemDiv.appendChild(removeBtn);
      listContainer.appendChild(itemDiv);
      classItems.push({ div: itemDiv, name: className });
    });
    
    // Input for adding new classes
    const inputContainer = makeEl("div", {
      style: "display:flex; align-items:center; gap:8px;"
    });
    const nextNumber = currentOrder.length + 1;
    inputContainer.appendChild(makeEl("span", {
      style: "font-weight:600; color:var(--muted); min-width:24px;"
    }, [`${nextNumber}.`]));
    const classInput = makeEl("input", {
      type: "text",
      class: "input",
      style: "flex:1; padding:8px; font-size:13px;",
      placeholder: "Enter class name and press Enter...",
      list: `classList-${key}`
    });
    
    // Add datalist with available classes for this group
    const datalist = makeEl("datalist", {
      id: `classList-${key}`
    });
    group.classes.forEach(cls => {
      datalist.appendChild(makeEl("option", { value: cls.name }, []));
    });
    groupSection.appendChild(datalist);
    
    classInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const className = classInput.value.trim();
        if (!className) return;
        
        // Verify class exists in this group
        if (!group.classes.find(c => c.name === className)) {
          showError("Class Not Found", `Class "${className}" is not in ${gradeLabel} - ${genderLabel} group.`, "Please enter a valid class name from this group.").then(() => {});
          return;
        }
        
        // Check if already in list
        const existingItems = Array.from(listContainer.querySelectorAll("div")).filter(div => div !== inputContainer);
        const existingNames = existingItems.map(item => {
          const nameSpan = item.querySelector("span:nth-child(2)");
          return nameSpan ? nameSpan.textContent.trim() : null;
        }).filter(name => name);
        
        if (existingNames.includes(className)) {
          showError("Duplicate Class", `Class "${className}" is already in the rotation order.`, "Each class can only appear once.").then(() => {});
          return;
        }
        
        // Add to list
        const itemDiv = makeEl("div", {
          style: "display:flex; align-items:center; gap:8px; padding:8px; background:white; border:1px solid var(--grid-soft); border-radius:6px;"
        });
        const newIndex = existingItems.length;
        itemDiv.appendChild(makeEl("span", {
          style: "font-weight:600; color:var(--muted); min-width:24px;"
        }, [`${newIndex + 1}.`]));
        itemDiv.appendChild(makeEl("span", {
          style: "flex:1;"
        }, [className]));
        const removeBtn = makeEl("button", {
          style: "background:none; border:none; color:var(--red); cursor:pointer; font-size:18px; padding:0 4px;",
          onclick: () => {
            itemDiv.remove();
            updateRotationList();
          }
        }, ["×"]);
        itemDiv.appendChild(removeBtn);
        listContainer.insertBefore(itemDiv, classInput.parentElement);
        classInput.value = "";
        updateRotationList();
        
        // Update number labels
        updateNumberLabels(listContainer);
      }
    });
    
    inputContainer.appendChild(classInput);
    listContainer.appendChild(inputContainer);
    groupSection.appendChild(listContainer);
    
    // Function to update rotation list
    function updateRotationList() {
      const items = Array.from(listContainer.querySelectorAll("div")).filter(div => div !== inputContainer);
      const order = items.map(item => {
        const nameSpan = item.querySelector("span:nth-child(2)");
        return nameSpan ? nameSpan.textContent.trim() : null;
      }).filter(name => name);
      
      currentOrder = order;
      saveRotationOrder(
        group.grade === "mixed" ? null : group.grade,
        group.gender === "girls" ? "all-girls" : group.gender === "boys" ? "all-boys" : null,
        order
      );
      
      updateNumberLabels(listContainer);
    }
    
    function updateNumberLabels(container) {
      const items = Array.from(container.querySelectorAll("div")).filter(div => div !== inputContainer);
      items.forEach((item, index) => {
        const numberSpan = item.querySelector("span:first-child");
        if (numberSpan) {
          numberSpan.textContent = `${index + 1}.`;
        }
      });
      const nextNum = items.length + 1;
      const inputNumberSpan = inputContainer.querySelector("span:first-child");
      if (inputNumberSpan) {
        inputNumberSpan.textContent = `${nextNum}.`;
      }
    }
    
    groupsContainer.appendChild(groupSection);
  });
  
  if (Object.keys(classesByGroup).length === 0) {
    groupsContainer.appendChild(makeEl("div", {
      style: "padding:20px; text-align:center; color:var(--muted);"
    }, ["No classes found. Create classes first."]));
  }
  
  modal.appendChild(groupsContainer);
  
  // Buttons
  const buttonsDiv = makeEl("div", {
    style: "display:flex; gap:12px; justify-content:flex-end; margin-top:20px;"
  });
  
  const closeBtn = makeEl("button", {
    class: "btn",
    style: "font-size:13px; padding:8px 16px; background:#f3f4f6; color:var(--ink); border:1px solid var(--grid-soft);",
    onclick: () => {
      document.body.removeChild(overlay);
    }
  }, ["Close"]);
  
  buttonsDiv.appendChild(closeBtn);
  modal.appendChild(buttonsDiv);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  });
}

// Helper function to rotate classes using stored rotation orders
function rotateClassesByStoredOrders() {
  const classes = getAllClasses();
  const rotationOrders = loadRotationOrders();
  
  // Group classes by grade/gender and rotate each group
  const classesByGroup = {};
  classes.forEach(cls => {
    const key = getRotationOrderKey(cls.gradeLevel, cls.gender);
    if (!classesByGroup[key]) {
      classesByGroup[key] = [];
    }
    classesByGroup[key].push(cls);
  });
  
  let rotatedCount = 0;
  const errors = [];
  
  // Rotate each group
  for (const [key, groupClasses] of Object.entries(classesByGroup)) {
    const order = rotationOrders[key];
    if (!order || order.length < 2) {
      continue; // Skip if no order set or not enough classes
    }
    
    try {
      rotateClasses(order.join(", "));
      rotatedCount += groupClasses.length;
    } catch (err) {
      errors.push(`${key}: ${err.message}`);
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Some rotations failed:\n${errors.join("\n")}`);
  }
  
  if (rotatedCount === 0) {
    throw new Error("No rotation orders are set. Please set rotation orders first.");
  }
  
  return rotatedCount;
}

// Helper function to rotate classes (names and teachers, but keep students)
function rotateClasses(rotationOrder) {
  const classes = getAllClasses();
  const classMap = {};
  classes.forEach(cls => {
    classMap[cls.name] = cls;
  });
  
  // Parse rotation order
  const order = rotationOrder.split(",").map(name => name.trim()).filter(name => name);
  
  if (order.length < 2) {
    throw new Error("Rotation order must include at least 2 classes");
  }
  
  // Verify all classes in order exist
  for (const className of order) {
    if (!classMap[className]) {
      throw new Error(`Class "${className}" not found`);
    }
  }
  
  // Get current students for each class (students stay with their groups)
  const studentsByClass = {};
  order.forEach(className => {
    studentsByClass[className] = getStudentsInClass(className);
  });
  
  // Create rotation mapping:
  // Class[i] gets Class[i-1]'s name and teacher, but keeps its own students
  const rotationMap = {};
  for (let i = 0; i < order.length; i++) {
    const currentClass = order[i];
    const prevClassIndex = (i - 1 + order.length) % order.length;
    const prevClassName = order[prevClassIndex];
    
    // Current class will receive previous class's name and teacher
    rotationMap[currentClass] = {
      newName: classMap[prevClassName].name,
      newTeacher: classMap[prevClassName].teacherEmail,
      newGradeLevel: classMap[prevClassName].gradeLevel,
      newGender: classMap[prevClassName].gender,
      students: studentsByClass[currentClass] // Keep current class's students
    };
  }
  
  // Apply rotations using temporary names to avoid conflicts
  const timestamp = Date.now();
  const tempNames = {};
  for (const [oldClassName, rotation] of Object.entries(rotationMap)) {
    if (oldClassName !== rotation.newName) {
      // Use temporary name to avoid conflicts
      const tempName = `_temp_rotate_${oldClassName}_${timestamp}`;
      tempNames[oldClassName] = tempName;
      updateClassName(oldClassName, tempName);
    }
  }
  
  // Now update to final names
  for (const [oldClassName, rotation] of Object.entries(rotationMap)) {
    const tempName = tempNames[oldClassName] || oldClassName;
    
    if (tempName !== rotation.newName) {
      // Update class name
      updateClassName(tempName, rotation.newName);
      
      // Update teacher
      updateClassTeacher(rotation.newName, rotation.newTeacher);
      
      // Update grade level and gender if they exist
      if (rotation.newGradeLevel !== undefined && rotation.newGradeLevel !== null) {
        updateClassGradeLevel(rotation.newName, rotation.newGradeLevel);
      }
      if (rotation.newGender !== undefined && rotation.newGender !== null) {
        updateClassGender(rotation.newName, rotation.newGender);
      }
      
      // Keep the students that were already in this class (they stay with their group)
      // No need to reassign - students are already in the right place
    } else {
      // Class name didn't change, but teacher might have
      updateClassTeacher(oldClassName, rotation.newTeacher);
      if (rotation.newGradeLevel !== undefined && rotation.newGradeLevel !== null) {
        updateClassGradeLevel(oldClassName, rotation.newGradeLevel);
      }
      if (rotation.newGender !== undefined && rotation.newGender !== null) {
        updateClassGender(oldClassName, rotation.newGender);
      }
    }
  }
}

// Render Classes Management Section
function renderAdminClasses(){
  const classes = getAllClasses();
  
  return makeEl("div", { class:"card", style:"margin-bottom:24px;" }, [
      makeEl("div", { 
      style:"display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px;" 
    }, [
      makeEl("div", { class:"sectionTitle", style:"margin:0; font-size:18px;" }, ["📚 Classes Management"]),
      makeEl("div", {
        style:"display:flex; gap:8px; align-items:center; flex-wrap:wrap;"
      }, [
        makeEl("button", {
          class: "btn",
          style: "font-size:12px; padding:6px 12px;",
          onclick: () => {
            showEditModal("Add New Class", [
              {
                key: "name",
                label: "Class Name",
                type: "text",
                value: "",
                placeholder: "Class Name",
                required: true,
                help: "Name of the class (e.g., Math 6A, Science 7B)"
              },
              {
                key: "teacher",
                label: "Teacher Email",
                type: "email",
                value: "",
                placeholder: "teacher@micds.org",
                required: true,
                help: "Must be a @micds.org email address"
              },
              {
                key: "gradeLevel",
                label: "Grade Level",
                type: "text",
                value: "",
                placeholder: "6, 7, 8, etc.",
                help: "Grade level for this class (optional)"
              },
              {
                key: "gender",
                label: "Class Type",
                type: "select",
                value: "mixed",
                options: [
                  { value: "mixed", label: "Mixed" },
                  { value: "girls", label: "All-Girls" },
                  { value: "boys", label: "All-Boys" }
                ],
                help: "Gender composition of the class"
              }
            ], (values) => {
              try {
                const className = values.name.trim();
                const teacherEmail = values.teacher.trim().toLowerCase();
                
                if (!className) {
                  showError("Class Name Required", "Please enter a class name.", "").then(() => {});
                  return;
                }
                
                if (!teacherEmail || !isValidMICDSEmail(teacherEmail)) {
                  showError("Invalid Teacher Email", "Please enter a valid @micds.org email address.", "").then(() => {});
                  return;
                }
                
                // Verify teacher exists
                if (!getAllTeachers().includes(teacherEmail)) {
                  showConfirm("Teacher Not Found", `Teacher "${teacherEmail}" is not in the system.`, "Would you like to add them now?").then(confirmed => {
                    if (!confirmed) return;
                    addTeacher(teacherEmail);
                    // Set default password
                    const defaultPassword = teacherEmail.split("@")[0] + "123";
                    setUserPassword(teacherEmail, defaultPassword);
                  });
                  return;
                }
                
                // Process gender
                let gender = null;
                if (values.gender === "girls") {
                  gender = "all-girls";
                } else if (values.gender === "boys") {
                  gender = "all-boys";
                }
                
                addClass(className, teacherEmail, gender, values.gradeLevel?.trim() || null);
                setStatus(`Created class: ${className}`);
                render();
              } catch (err) {
                showError("Operation Failed", "Unable to complete the operation.", err.message).then(() => {});
              }
            });
          }
        }, ["➕ Add Class"]),
        // Rotate Classes section
        makeEl("div", {
          style:"display:flex; align-items:center; gap:6px; position:relative;"
        }, [
          makeEl("button", {
            class: "btn",
            style: "font-size:12px; padding:6px 12px; white-space:nowrap;",
            onclick: () => {
              showRotationOrderModal();
            }
          }, ["⚙️ Set Rotation Orders"]),
          makeEl("button", {
            class: "btn primary",
            style: "font-size:12px; padding:6px 12px; white-space:nowrap;",
            onclick: () => {
              showConfirm("Rotate Classes", `This will rotate class names and teachers according to the stored rotation orders for each grade/gender combination. Student groups will remain with their current classes.`, "Are you sure you want to proceed?").then(confirmed => {
                if (!confirmed) return;
                try {
                  rotateClassesByStoredOrders();
                  setStatus("Classes rotated successfully");
                  render();
                } catch (err) {
                  showError("Rotation Failed", "Unable to rotate classes.", err.message).then(() => {});
                }
              });
            }
          }, ["🔄 Rotate Classes"]),
          (() => {
            const infoContainer = makeEl("span", {
              style: "position:relative; display:inline-block; cursor:help;"
            });
            const infoIcon = makeEl("span", {
              style: "font-size:14px; color:var(--blue);"
            }, ["ℹ️"]);
            const tooltip = makeEl("div", {
              style: "display:none; position:absolute; bottom:100%; left:50%; transform:translateX(-50%); margin-bottom:8px; padding:8px 12px; background:#1f2937; color:white; border-radius:6px; font-size:11px; white-space:normal; z-index:10001; max-width:300px; width:300px; box-shadow:0 4px 12px rgba(0,0,0,0.3); pointer-events:none;"
            }, ["Set rotation orders for each grade/gender combination. Classes will rotate in the order you specify, with names and teachers rotating while student groups stay together. Use 'Set Rotation Orders' to configure, then 'Rotate Classes' to apply."]);
            
            infoIcon.addEventListener("mouseenter", () => {
              tooltip.style.display = "block";
            });
            
            infoIcon.addEventListener("mouseleave", () => {
              tooltip.style.display = "none";
            });
            
            infoContainer.appendChild(infoIcon);
            infoContainer.appendChild(tooltip);
            return infoContainer;
          })()
        ])
      ])
    ]),
    makeEl("div", { style:"margin-top:12px;" }, [
      classes.length === 0 
        ? makeEl("div", { class:"muted", style:"padding:12px; text-align:center;" }, ["No classes created yet"])
        : makeEl("div", { style:"display:flex; flex-direction:column; gap:8px;" }, 
            classes.map(cls => {
              const studentCount = cls.students?.length || 0;
              const mismatched = getMismatchedStudentsInClass(cls.name);
              const hasMismatches = mismatched.length > 0;
              
              return makeEl("div", {
                key: cls.name,
                style:`padding:12px; background:#f9fafb; border:2px solid ${hasMismatches ? "#ef4444" : "var(--grid-soft)"}; border-radius:8px;`
              }, [
                makeEl("div", { style:"display:flex; justify-content:space-between; align-items:start; margin-bottom:8px;" }, [
                  makeEl("div", { style:"flex:1;" }, [
                    makeEl("div", { style:"font-weight:600; margin-bottom:4px;" }, [cls.name]),
                    makeEl("div", { class:"muted", style:"font-size:12px; margin-bottom:4px;" }, [
                      `Teacher: ${cls.teacherEmail}`
                    ]),
                    makeEl("div", { class:"muted", style:"font-size:12px; margin-bottom:4px;" }, [
                      `Grade Level: ${cls.gradeLevel || "—"} | Type: ${cls.gender === "all-girls" ? "👧 All-Girls" : cls.gender === "all-boys" ? "👦 All-Boys" : "👥 Mixed"}`
                    ]),
                    makeEl("div", { class:"muted", style:"font-size:12px; margin-bottom:4px;" }, [
                      `Created: ${cls.createdAt ? new Date(cls.createdAt).toLocaleDateString() : "—"}`
                    ]),
                    makeEl("div", { class:"muted", style:"font-size:12px;" }, [
                      `${studentCount} student${studentCount !== 1 ? "s" : ""}`
                    ]),
                    hasMismatches ? makeEl("div", {
                      style:"margin-top:12px; padding:12px; background:#fee2e2; border:1px solid #ef4444; border-radius:6px;"
                    }, [
                      makeEl("div", {
                        style:"font-weight:600; color:#991b1b; margin-bottom:8px; font-size:13px;"
                      }, ["⚠️ Mismatched Students:"]),
                      makeEl("div", {
                        style:"display:flex; flex-direction:column; gap:6px;"
                      }, mismatched.map(m => 
                        makeEl("div", {
                          style:"font-size:12px; color:#7f1d1d;"
                        }, [
                          makeEl("div", {
                            style:"font-weight:600; margin-bottom:2px;"
                          }, [`${m.name} (${m.email}):`]),
                          makeEl("div", {
                            style:"padding-left:12px;"
                          }, m.errors.map(err => 
                            makeEl("div", {}, [`• ${err}`])
                          ))
                        ])
                      ))
                    ]) : null
                  ]),
                  makeEl("div", { style:"display:flex; gap:8px;" }, [
                    makeEl("button", {
                      class: "btn",
                      style: "font-size:11px; padding:4px 8px;",
                      onclick: () => {
                        const currentGender = cls.gender || "";
                        const genderValue = currentGender === "all-girls" ? "girls" : currentGender === "all-boys" ? "boys" : "mixed";
                        
                        showEditModal("Edit Class", [
                          {
                            key: "name",
                            label: "Class Name",
                            type: "text",
                            value: cls.name,
                            placeholder: "Class Name",
                            required: true
                          },
                          {
                            key: "teacher",
                            label: "Teacher Email",
                            type: "email",
                            value: cls.teacherEmail,
                            placeholder: "teacher@micds.org",
                            required: true,
                            help: "Must be a @micds.org email address"
                          },
                          {
                            key: "gradeLevel",
                            label: "Grade Level",
                            type: "text",
                            value: cls.gradeLevel || "",
                            placeholder: "6, 7, 8, etc.",
                            help: "Grade level for this class"
                          },
                          {
                            key: "gender",
                            label: "Class Type",
                            type: "select",
                            value: genderValue,
                            options: [
                              { value: "mixed", label: "Mixed" },
                              { value: "girls", label: "All-Girls" },
                              { value: "boys", label: "All-Boys" }
                            ],
                            help: "Gender composition of the class"
                          }
                        ], (values) => {
                          try {
                            const finalClassName = values.name.trim() || cls.name;
                            const nameChanged = finalClassName !== cls.name;
                            
                            // Update class name first if changed
                            if (nameChanged) {
                              updateClassName(cls.name, finalClassName);
                            }
                            
                            // Update teacher if changed
                            if (values.teacher.trim() && values.teacher.trim() !== cls.teacherEmail) {
                              if (!getAllTeachers().includes(values.teacher.trim().toLowerCase())) {
                                showConfirm("Teacher Not Found", `Teacher "${values.teacher}" is not in the system.`, "Would you like to add them now?").then(confirmed => {
                                  if (!confirmed) return;
                                  addTeacher(values.teacher.trim());
                                });
                                return;
                              }
                              updateClassTeacher(finalClassName, values.teacher.trim().toLowerCase());
                            }
                            
                            // Update grade level if changed
                            if (values.gradeLevel.trim() !== (cls.gradeLevel || "")) {
                              updateClassGradeLevel(finalClassName, values.gradeLevel.trim() || null);
                            }
                            
                            // Update gender type
                            let gender = null;
                            if (values.gender === "girls") {
                              gender = "all-girls";
                            } else if (values.gender === "boys") {
                              gender = "all-boys";
                            }
                            if (gender !== cls.gender) {
                              updateClassGender(finalClassName, gender);
                            }
                            
                            setStatus(`Updated class: ${nameChanged ? cls.name + " → " + finalClassName : finalClassName}`);
                            render();
                          } catch (err) {
                            showError("Operation Failed", "Unable to complete the operation.", err.message);
                          }
                        });
                      }
                    }, ["✏️ Edit"]),
                    makeEl("button", {
                      class: "btn",
                      style: "font-size:11px; padding:4px 8px;",
                      onclick: () => {
                        showEditModal("Add Student to Class", [
                          {
                            key: "email",
                            label: "Student Email",
                            type: "email",
                            value: "",
                            placeholder: "student@micds.org",
                            required: true,
                            help: "Must be a @micds.org email address"
                          }
                        ], (values) => {
                          const studentEmail = values.email.trim().toLowerCase();
                          if (!studentEmail) return;
                          
                          try {
                            if (!getAllAssignedStudents().includes(studentEmail)) {
                              showConfirm("Student Not Found", `Student "${studentEmail}" is not in the system.`, "Would you like to add them now?").then(confirmed => {
                                if (!confirmed) return;
                                showAddStudentModal(studentEmail, (email, name, grade, gender) => {
                                  // Continue with adding to class after student is added
                                  const student = getStudent(email.toLowerCase());
                                  if (student) {
                                    const check = checkStudentClassMatch(email.toLowerCase(), cls.name);
                                    if (!check.match) {
                                      const errorMsg = check.errors.join("\n");
                                      showConfirm("Class Requirements Mismatch", `This student does not match the class requirements:`, errorMsg + "\n\nDo you still want to add them?").then(confirmed => {
                                        if (!confirmed) return;
                                        addStudentToClass(email.toLowerCase(), cls.name);
                                        setStatus(`Added ${email} to ${cls.name}`);
                                        render();
                                      });
                                      return;
                                    }
                                  }
                                  addStudentToClass(email.toLowerCase(), cls.name);
                                  setStatus(`Added ${email} to ${cls.name}`);
                                  render();
                                });
                              });
                              return;
                            }
                            
                            // Check if student matches class requirements before adding
                            const student = getStudent(studentEmail);
                            if (student) {
                              const check = checkStudentClassMatch(studentEmail, cls.name);
                              if (!check.match) {
                                const errorMsg = check.errors.join("\n");
                                showConfirm("Class Requirements Mismatch", `This student does not match the class requirements:`, errorMsg + "\n\nDo you still want to add them?").then(confirmed => {
                                  if (!confirmed) return;
                                  addStudentToClass(studentEmail, cls.name);
                                  setStatus(`Added ${values.email} to ${cls.name}`);
                                  render();
                                });
                                return;
                              }
                            }
                            
                            addStudentToClass(studentEmail, cls.name);
                            setStatus(`Added ${values.email} to ${cls.name}`);
                            render();
                          } catch (err) {
                            showError("Operation Failed", "Unable to complete the operation.", err.message).then(() => {});
                          }
                        });
                      }
                    }, ["➕ Add Student"]),
                    makeEl("button", {
                      class: "btn danger-outline",
                      style: "font-size:11px; padding:4px 8px;",
                      onclick: () => {
                        showConfirm("Delete Class", `Are you sure you want to delete class "${cls.name}"?`, "This will remove all student assignments. This action cannot be undone.").then(confirmed => {
                          if (!confirmed) return;
                          try {
                            removeClass(cls.name);
                            setStatus(`Deleted class: ${cls.name}`);
                            render();
                          } catch (err) {
                            showError("Operation Failed", "Unable to complete the operation.", err.message).then(() => {});
                          }
                        });
                      }
                    }, ["🗑️ Delete"])
                  ])
                ]),
                studentCount > 0 ? makeEl("div", {
                  style:"margin-top:8px; padding-top:8px; border-top:1px solid var(--grid-soft);"
                }, [
                  makeEl("div", { class:"muted", style:"font-size:11px; margin-bottom:4px;" }, ["Students in this class:"]),
                  makeEl("div", { style:"display:flex; flex-wrap:wrap; gap:4px;" }, 
                    cls.students.map(studentEmail => 
                      makeEl("span", {
                        style:"display:inline-flex; align-items:center; gap:4px; padding:4px 8px; background:white; border:1px solid var(--grid-soft); border-radius:4px; font-size:11px;"
                      }, [
                        makeEl("span", {}, [studentEmail]),
                        makeEl("button", {
                          style:"background:none; border:none; cursor:pointer; color:var(--red); font-size:12px; padding:0; margin-left:4px;",
                          onclick: (e) => {
                            e.stopPropagation();
                            showConfirm("Remove Student", `Remove "${studentEmail}" from class "${cls.name}"?`, "The student will no longer be enrolled in this class.").then(confirmed => {
                              if (!confirmed) return;
                              try {
                                removeStudentFromClass(studentEmail, cls.name);
                                setStatus(`Removed ${studentEmail} from ${cls.name}`);
                                render();
                              } catch (err) {
                                showError("Operation Failed", "Unable to complete the operation.", err.message).then(() => {});
                              }
                            });
                          }
                        }, ["×"])
                      ])
                    )
                  )
                ]) : null
              ]);
            })
          )
    ])
  ]);
}

// Main admin panel function with tabs
function renderAdminPanel(){
  const tabsContainer = renderAdminSubTabs();
  
  let contentSection;
  if (state.adminSubTab === "students") {
    contentSection = renderAdminStudents();
  } else if (state.adminSubTab === "teachers") {
    contentSection = renderAdminTeachers();
  } else if (state.adminSubTab === "classes") {
    contentSection = renderAdminClasses();
  } else {
    // Default to students
    state.adminSubTab = "students";
    contentSection = renderAdminStudents();
  }
  
  return makeEl("div", {}, [
    makeEl("div", { class:"sectionTitle" }, ["Admin Panel"]),
    makeEl("div", { class:"muted", style:"margin-bottom:24px;" }, [
      "Manage teachers, students, and classes."
    ]),
    tabsContainer,
    contentSection
  ]);
}

function renderManageClasses(){
  const teacherEmail = state.loggedInUser;
  if (!teacherEmail) return makeEl("div", { class:"card" }, ["Not logged in"]);
  
  const classes = getClassesForTeacher(teacherEmail);
  const allStudents = getAllStudentsWithNames();
  
  // Add Class Section
  const addClassSection = makeEl("div", { class:"card", style:"margin-bottom:20px;" }, [
    makeEl("div", { class:"sectionTitle" }, ["Add New Class"]),
    makeEl("div", { style:"display:flex; gap:10px; margin-top:12px;" }, [
      makeEl("input", {
        id: "newClassName",
        type: "text",
        class: "input",
        placeholder: "Class name (e.g., Math 6A)",
        style: "flex:1;"
      }),
      makeEl("button", {
        class: "btn",
        onclick: () => {
          const input = $("newClassName");
          const className = input.value.trim();
          if (!className){
            showError("Class Name Required", "Please enter a class name to continue.", "Class names should be descriptive (e.g., 'Math 6A', 'Science 7B').");
            return;
          }
          try {
            addClass(className, teacherEmail);
            input.value = "";
            setStatus(`Class "${className}" added successfully`);
            render();
          } catch (e) {
            showError("Unable to Create Class", "Failed to create the class.", e.message);
          }
        }
      }, ["Add Class"])
    ])
  ]);
  
  // Classes List
  const classesList = makeEl("div", { class:"card" }, [
    makeEl("div", { class:"sectionTitle" }, ["My Classes"]),
    makeEl("div", { class:"muted", style:"margin-bottom:16px;" }, [
      classes.length === 0 
        ? "No classes yet. Add a class above to get started."
        : `You have ${classes.length} class${classes.length !== 1 ? "es" : ""}.`
    ]),
    ...classes.map(cls => {
      const studentsInClass = getStudentsInClass(cls.name);
      const studentRecords = studentsInClass.map(email => {
        const student = getStudent(email);
        const username = email.replace("@micds.org", "");
        const nameParts = username.split(".");
        const displayName = nameParts.map(part => 
          part.charAt(0).toUpperCase() + part.slice(1)
        ).join(" ");
        return { email, displayName, username };
      });
      
      const mismatched = getMismatchedStudentsInClass(cls.name);
      const hasMismatches = mismatched.length > 0;
      
      return makeEl("div", {
        class: "card",
        style: `margin-top:16px; padding:16px; border:2px solid ${hasMismatches ? "#ef4444" : "var(--grid-soft)"};`
      }, [
        makeEl("div", {
          style: "display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;"
        }, [
          makeEl("div", { class:"sectionTitle", style:"margin:0; font-size:18px;" }, [cls.name]),
          makeEl("button", {
            class: "btn danger-outline",
            style: "font-size:12px; padding:6px 12px;",
            onclick: () => {
              showConfirm("Delete Class", `Are you sure you want to delete the class "${cls.name}"?`, "This will remove all student assignments. This action cannot be undone.").then(confirmed => {
                if (!confirmed) return;
                removeClass(cls.name);
                setStatus(`Class "${cls.name}" deleted`);
                render();
              });
            }
          }, ["Delete"])
        ]),
        makeEl("div", { class:"muted", style:"margin-bottom:12px; font-size:13px;" }, [
          `${studentsInClass.length} student${studentsInClass.length !== 1 ? "s" : ""}`
        ]),
        hasMismatches ? makeEl("div", {
          style:"margin-bottom:12px; padding:12px; background:#fee2e2; border:1px solid #ef4444; border-radius:6px;"
        }, [
          makeEl("div", {
            style:"font-weight:600; color:#991b1b; margin-bottom:8px; font-size:13px;"
          }, ["⚠️ Mismatched Students:"]),
          makeEl("div", {
            style:"display:flex; flex-direction:column; gap:6px;"
          }, mismatched.map(m => 
            makeEl("div", {
              style:"font-size:12px; color:#7f1d1d;"
            }, [
              makeEl("div", {
                style:"font-weight:600; margin-bottom:2px;"
              }, [`${m.name} (${m.email}):`]),
              makeEl("div", {
                style:"padding-left:12px;"
              }, m.errors.map(err => 
                makeEl("div", {}, [`• ${err}`])
              ))
            ])
          ))
        ]) : null,
        
        // Add Student Section
        makeEl("div", { style:"margin-bottom:16px; padding:12px; background:#f9fafb; border-radius:8px;" }, [
          makeEl("div", { style:"font-weight:600; margin-bottom:8px; font-size:13px;" }, ["Add Student to Class"]),
          makeEl("div", { style:"position:relative;" }, [
            makeEl("input", {
              id: `studentSearch-${cls.name}`,
              type: "text",
              class: "input",
              placeholder: "Search by name...",
              style: "width:100%;",
              oninput: (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                const resultsDiv = $(`searchResults-${cls.name}`);
                if (!resultsDiv) return;
                
                if (searchTerm.length < 1){
                  resultsDiv.style.display = "none";
                  return;
                }
                
                // Filter students
                const filtered = allStudents.filter(s => {
                  const nameMatch = s.displayName.toLowerCase().includes(searchTerm);
                  const emailMatch = s.email.toLowerCase().includes(searchTerm);
                  const usernameMatch = s.username.toLowerCase().includes(searchTerm);
                  const alreadyInClass = studentsInClass.includes(s.email);
                  return (nameMatch || emailMatch || usernameMatch) && !alreadyInClass;
                });
                
                resultsDiv.innerHTML = "";
                if (filtered.length === 0){
                  resultsDiv.style.display = "none";
                } else {
                  resultsDiv.style.display = "block";
                  filtered.slice(0, 10).forEach(student => {
                    const item = makeEl("div", {
                      style: "padding:10px; cursor:pointer; border-bottom:1px solid var(--grid-soft); transition:background 0.2s;",
                      onmouseenter: (e) => e.target.style.background = "#f0f0f0",
                      onmouseleave: (e) => e.target.style.background = "",
                      onclick: () => {
                        try {
                          ensureStudent(student.email);
                          // Check if student matches class requirements
                          const check = checkStudentClassMatch(student.email, cls.name);
                          if (!check.match) {
                            const errorMsg = check.errors.join("\n");
                            if (!confirm(`⚠️ Warning: This student does not match the class requirements:\n\n${errorMsg}\n\nDo you still want to add them?`)) {
                              return;
                            }
                          }
                          addStudentToClass(student.email, cls.name);
                          const searchInput = $(`studentSearch-${cls.name}`);
                          if (searchInput) searchInput.value = "";
                          resultsDiv.style.display = "none";
                          setStatus(`Added ${student.displayName} to ${cls.name}`);
                          render();
                        } catch (err) {
                          showError("Operation Failed", "Unable to complete the operation.", err.message);
                        }
                      }
                    }, [
                      makeEl("div", { style:"font-weight:600;" }, [student.displayName]),
                      makeEl("div", { class:"muted", style:"font-size:12px;" }, [student.email])
                    ]);
                    resultsDiv.appendChild(item);
                  });
                }
              },
              onblur: () => {
                // Delay hiding to allow click on results
                setTimeout(() => {
                  const resultsDiv = $(`searchResults-${cls.name}`);
                  if (resultsDiv) resultsDiv.style.display = "none";
                }, 200);
              }
            }),
            makeEl("div", {
              id: `searchResults-${cls.name}`,
              style: "display:none; position:absolute; top:100%; left:0; right:0; background:white; border:1px solid var(--grid-soft); border-radius:8px; margin-top:4px; max-height:300px; overflow-y:auto; z-index:1000; box-shadow:0 4px 12px rgba(0,0,0,0.1);"
            })
          ])
        ]),
        
        // Students in Class List
        makeEl("div", { style:"margin-top:16px;" }, [
          makeEl("div", { style:"font-weight:600; margin-bottom:8px; font-size:13px;" }, ["Students in Class"]),
          studentRecords.length === 0
            ? makeEl("div", { class:"muted", style:"font-size:12px; padding:8px;" }, ["No students yet"])
            : makeEl("div", { style:"display:flex; flex-direction:column; gap:8px;" }, 
                studentRecords.map(record => 
                  makeEl("div", {
                    style: "display:flex; justify-content:space-between; align-items:center; padding:10px; background:#f9fafb; border-radius:6px;"
                  }, [
                    makeEl("div", {}, [
                      makeEl("div", { style:"font-weight:600; font-size:13px;" }, [record.displayName]),
                      makeEl("div", { class:"muted", style:"font-size:12px;" }, [record.email])
                    ]),
                    makeEl("button", {
                      class: "btn danger-outline",
                      style: "font-size:11px; padding:4px 8px;",
                      onclick: () => {
                        showConfirm("Remove Student", `Remove "${record.displayName}" from class "${cls.name}"?`, "The student will no longer be enrolled in this class.").then(confirmed => {
                          if (!confirmed) return;
                          removeStudentFromClass(record.email, cls.name);
                          setStatus(`Removed ${record.displayName} from ${cls.name}`);
                          render();
                        });
                      }
                    }, ["Remove"])
                  ])
                )
              )
        ])
      ]);
    })
  ]);
  
  return makeEl("div", {}, [
    addClassSection,
    classesList
  ]);
}

function renderAllStudents(){
  // Get all students with assessment records
  const allStudents = getAllStudents();
  // Get registered students (those in admin DB)
  const registeredStudentEmails = new Set(getAllAssignedStudents().map(email => email.toLowerCase()));
  
  // Filter to only show registered students
  const registeredStudents = allStudents.filter(student => 
    registeredStudentEmails.has(student.email.toLowerCase())
  );
  
  if (registeredStudents.length === 0){
    return makeEl("div", { class:"card" }, [
      makeEl("div", { class:"sectionTitle" }, ["All Students"]),
      makeEl("div", { class:"muted" }, ["No registered students found. Add students in the Admin Panel first."])
    ]);
  }
  
  // Get teacher's classes for filtering
  const teacherEmail = state.loggedInUser;
  const teacherClasses = teacherEmail ? getClassesForTeacher(teacherEmail) : [];
  const allClassesData = loadClasses();
  
  // For teachers without classes, show a message
  if ((state.isTeacher || state.userRole === "teacher") && teacherClasses.length === 0) {
    return makeEl("div", { class:"card" }, [
      makeEl("div", { class:"sectionTitle" }, ["All Students"]),
      makeEl("div", { class:"muted", style:"margin-top:12px; padding:16px; background:#fff3cd; border:1px solid #ffc107; border-radius:8px;" }, [
        makeEl("div", { style:"font-weight:600; margin-bottom:8px; color:#856404;" }, ["No Classes Assigned"]),
        makeEl("div", { style:"font-size:13px; color:#856404;" }, [
          "You are registered as a teacher but have not been assigned to any classes yet. " +
          "Please contact an administrator to be assigned to a class, or use the Admin Panel to create and assign yourself to a class."
        ])
      ])
    ]);
  }
  
  // Calculate grades and standard averages for all registered students
  const studentsWithData = registeredStudents.map(student => {
    const overall = computeOverallGrade(student);
    const s1 = computeStandardAverage(RUBRIC.s1, student);
    const s2 = computeStandardAverage(RUBRIC.s2, student);
    const s3 = computeStandardAverage(RUBRIC.s3, student);
    const s4 = computeStandardAverage(RUBRIC.s4, student);
    
    // Get classes this student is in
    const studentClasses = allClassesData.studentClasses?.[student.email] || [];
    
    // Generate display name from email
    const username = student.email.replace("@micds.org", "");
    const nameParts = username.split(".");
    const displayName = nameParts.map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(" ");
    
    return {
      ...student,
      overall,
      s1, s2, s3, s4,
      studentClasses,
      displayName,
      username
    };
  });
  
  // Use state.filters for persistence
  const filterState = state.filters;
  
  // Filter function - each filter works independently
  // Note: searchQuery is used when a student is selected from the autocomplete dropdown
  const applyFilters = (students) => {
    return students.filter(student => {
      // Search filter - when searchQuery is set (from dropdown selection), show only that student
      if (filterState.searchQuery !== ""){
        const query = filterState.searchQuery.toLowerCase().trim();
        // Exact match by email, or partial match by name/username
        const matchesEmail = student.email.toLowerCase() === query;
        const matchesName = student.displayName?.toLowerCase().includes(query);
        const matchesUsername = student.username?.toLowerCase().includes(query);
        if (!matchesEmail && !matchesName && !matchesUsername) return false;
      }
      
      // Grade filter - works independently (can use min only, max only, or both)
      if (filterState.gradeMin !== "" || filterState.gradeMax !== ""){
        const overall = student.overall;
        if (overall === null) return false;
        const min = filterState.gradeMin === "" ? 0 : parseFloat(filterState.gradeMin);
        const max = filterState.gradeMax === "" ? 4 : parseFloat(filterState.gradeMax);
        if (overall < min || overall > max) return false;
      }
      
      // Class filter - works independently
      if (filterState.classFilter !== ""){
        if (!student.studentClasses.includes(filterState.classFilter)) return false;
      }
      
      // Standard rating filter - works independently (requires both standard AND rating to be set)
      // If only standard is selected without rating, don't filter by this
      if (filterState.standardFilter !== "" && filterState.standardRating !== ""){
        const standard = filterState.standardFilter;
        const rating = parseInt(filterState.standardRating);
        const studentRating = student[standard]; // This should be s1, s2, s3, or s4 from studentsWithData
        if (studentRating === null || studentRating === undefined) {
          return false;
        }
        // Round to nearest integer for comparison
        const roundedRating = Math.round(studentRating);
        if (roundedRating !== rating) return false;
      }
      
      // If we get here, student passes all active filters
      return true;
    });
  };
  
  // Filter controls - polished design
  // Check if any filters are active (standard filter only counts if rating is also set)
  // Note: searchQuery is now for autocomplete, not filtering
  const hasActiveFilters = 
    filterState.gradeMin || 
    filterState.gradeMax || 
    filterState.classFilter || 
    (filterState.standardFilter && filterState.standardRating);
  
  const filterSection = makeEl("div", { class:"card", style:"margin-bottom:24px; padding:20px;" }, [
    makeEl("div", { 
      style:"display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;" 
    }, [
      makeEl("div", { class:"sectionTitle", style:"margin:0; font-size:18px;" }, ["🔍 Filter Students"]),
      hasActiveFilters ? makeEl("button", {
        class: "btn danger-outline",
        style: "font-size:12px; padding:6px 12px;",
        onclick: () => {
          state.filters = {
            gradeMin: "",
            gradeMax: "",
            classFilter: "",
            standardFilter: "",
            standardRating: "",
            searchQuery: "" // Keep for autocomplete, but don't use for filtering
          };
          render();
        }
      }, ["Clear All"]) : null
    ]),
    
    // Search bar with autocomplete dropdown
    makeEl("div", { style:"margin-bottom:16px; padding:12px; background:#f0f9ff; border-radius:8px; border:1px solid #bae6fd; position:relative;" }, [
      makeEl("label", { style:"display:block; font-weight:600; margin-bottom:8px; font-size:13px; color:var(--ink);" }, ["🔎 Search Students"]),
      (() => {
        const container = makeEl("div", { style:"position:relative;" });
        
        const searchInput = makeEl("input", {
          id: "studentSearchInput",
          type: "text",
          class: "input",
          placeholder: "Type student name or email...",
          style: "width:100%; padding:10px; font-size:14px;",
          value: "",
          oninput: (e) => {
            const query = e.target.value.trim().toLowerCase();
            const dropdown = $("studentSearchDropdown");
            
            if (query.length === 0) {
              if (dropdown) dropdown.style.display = "none";
              return;
            }
            
            // Get all students with names
            const allStudents = getAllStudentsWithNames();
            
            // Filter students that match the query
            const matches = allStudents.filter(student => {
              const nameMatch = student.displayName.toLowerCase().includes(query);
              const emailMatch = student.email.toLowerCase().includes(query);
              const usernameMatch = student.username.toLowerCase().includes(query);
              return nameMatch || emailMatch || usernameMatch;
            });
            
            // Show/hide dropdown
            if (dropdown) {
              dropdown.innerHTML = "";
              
              if (matches.length === 0) {
                dropdown.appendChild(makeEl("div", {
                  style: "padding:12px; text-align:center; color:var(--muted); font-size:13px;"
                }, ["No students found"]));
                dropdown.style.display = "block";
              } else {
                matches.forEach(student => {
                  const option = makeEl("div", {
                    style: "padding:10px 12px; cursor:pointer; border-bottom:1px solid var(--grid-soft); transition:background 0.2s;",
                    onmouseenter: (e) => e.target.style.background = "#f3f4f6",
                    onmouseleave: (e) => e.target.style.background = "white",
                    onclick: (e) => {
                      e.stopPropagation();
                      // Filter table to show only this student
                      state.filters.searchQuery = student.email; // Use email as filter
                      // Clear search input and hide dropdown
                      searchInput.value = "";
                      dropdown.style.display = "none";
                      // Re-render to update the table with the filter applied
                      render();
                    }
                  }, [
                    makeEl("div", {
                      style: "font-weight:600; font-size:14px; color:var(--ink); margin-bottom:2px;"
                    }, [student.displayName]),
                    makeEl("div", {
                      style: "font-size:12px; color:var(--muted);"
                    }, [student.email])
                  ]);
                  dropdown.appendChild(option);
                });
                dropdown.style.display = "block";
              }
            }
          },
          onfocus: (e) => {
            const query = e.target.value.trim();
            const dropdown = $("studentSearchDropdown");
            if (query.length > 0 && dropdown) {
              dropdown.style.display = "block";
            }
          },
          onblur: (e) => {
            // Delay hiding dropdown to allow clicks on options
            setTimeout(() => {
              const dropdown = $("studentSearchDropdown");
              if (dropdown) {
                dropdown.style.display = "none";
              }
            }, 200);
          }
        });
        
        const dropdown = makeEl("div", {
          id: "studentSearchDropdown",
          style: "display:none; position:absolute; top:100%; left:0; right:0; margin-top:4px; background:white; border:1px solid var(--grid-soft); border-radius:8px; max-height:300px; overflow-y:auto; z-index:1000; box-shadow:0 4px 12px rgba(0,0,0,0.15);"
        });
        
        container.appendChild(searchInput);
        container.appendChild(dropdown);
        
        // Close dropdown when clicking outside
        setTimeout(() => {
          const closeHandler = (e) => {
            if (!container.contains(e.target) && e.target !== searchInput) {
              dropdown.style.display = "none";
            }
          };
          document.addEventListener("click", closeHandler);
        }, 100);
        
        return container;
      })()
    ]),
    
    makeEl("div", { style:"display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:16px;" }, [
      // Grade range filter
      makeEl("div", { style:"padding:12px; background:#f9fafb; border-radius:8px; border:1px solid var(--grid-soft);" }, [
        makeEl("label", { style:"display:block; font-weight:600; margin-bottom:8px; font-size:13px; color:var(--ink);" }, ["📊 Overall Grade"]),
        makeEl("div", { style:"display:flex; gap:8px; align-items:center;" }, [
          makeEl("input", {
            id: "filterGradeMin",
            type: "number",
            class: "input",
            placeholder: "Min",
            min: "0",
            max: "4",
            step: "0.1",
            style: "width:70px; padding:8px;",
            value: filterState.gradeMin,
            oninput: (e) => {
              state.filters.gradeMin = e.target.value;
              render();
            }
          }),
          makeEl("span", { class:"muted", style:"font-size:12px;" }, ["—"]),
          makeEl("input", {
            id: "filterGradeMax",
            type: "number",
            class: "input",
            placeholder: "Max",
            min: "0",
            max: "4",
            step: "0.1",
            style: "width:70px; padding:8px;",
            value: filterState.gradeMax,
            oninput: (e) => {
              state.filters.gradeMax = e.target.value;
              render();
            }
          })
        ])
      ]),
      
      // Class filter
      makeEl("div", { style:"padding:12px; background:#f9fafb; border-radius:8px; border:1px solid var(--grid-soft);" }, [
        makeEl("label", { style:"display:block; font-weight:600; margin-bottom:8px; font-size:13px; color:var(--ink);" }, ["🏫 Class"]),
        makeEl("select", {
          id: "filterClass",
          class: "input",
          style: "width:100%; padding:8px;",
          value: filterState.classFilter,
          onchange: (e) => {
            state.filters.classFilter = e.target.value;
            render();
          }
        }, [
          makeEl("option", { value: "" }, ["All Classes"]),
          ...teacherClasses.map(cls => makeEl("option", { value: cls.name }, [cls.name]))
        ])
      ]),
      
      // Standard rating filter
      makeEl("div", { style:"padding:12px; background:#f9fafb; border-radius:8px; border:1px solid var(--grid-soft);" }, [
        makeEl("label", { style:"display:block; font-weight:600; margin-bottom:8px; font-size:13px; color:var(--ink);" }, ["⭐ Standard Rating"]),
        makeEl("div", { style:"display:flex; gap:8px;" }, [
          (() => {
            const standardSelect = makeEl("select", {
              id: "filterStandard",
              class: "input",
              style: "flex:1; padding:8px;",
              onchange: (e) => {
                state.filters.standardFilter = e.target.value;
                if (!e.target.value) {
                  state.filters.standardRating = "";
                }
                render();
              }
            }, [
              makeEl("option", { value: "" }, ["Select Standard"]),
              makeEl("option", { value: "s1" }, ["Standard 1"]),
              makeEl("option", { value: "s2" }, ["Standard 2"]),
              makeEl("option", { value: "s3" }, ["Standard 3"]),
              makeEl("option", { value: "s4" }, ["Standard 4"])
            ]);
            standardSelect.value = filterState.standardFilter;
            return standardSelect;
          })(),
          (() => {
            const ratingSelect = makeEl("select", {
              id: "filterRating",
              class: "input",
              style: `width:70px; padding:8px; ${filterState.standardFilter === "" ? "opacity:0.5; cursor:not-allowed;" : ""}`,
              disabled: filterState.standardFilter === "",
              onchange: (e) => {
                state.filters.standardRating = e.target.value;
                render();
              }
            }, [
              makeEl("option", { value: "" }, ["—"]),
              makeEl("option", { value: "1" }, ["1"]),
              makeEl("option", { value: "2" }, ["2"]),
              makeEl("option", { value: "3" }, ["3"]),
              makeEl("option", { value: "4" }, ["4"])
            ]);
            ratingSelect.value = filterState.standardRating;
            return ratingSelect;
          })()
        ])
      ])
    ])
  ]);
  
  // Apply filters
  let filteredStudents = applyFilters(studentsWithData);
  
  // Sort students by email
  const sortedStudents = [...filteredStudents].sort((a, b) => 
    (a.email || "").localeCompare(b.email || "")
  );
  
  // Calculate score distributions for each standard using filtered students
  // This ensures charts reflect the active filters (e.g., class filter)
  // Use filtered students to show data for the selected class/filters
  const studentsForCharts = filteredStudents;
  const standardDistributions = {
    s1: computePopulationCounts(studentsForCharts, RUBRIC.s1.map(x => x.key)),
    s2: computePopulationCounts(studentsForCharts, RUBRIC.s2.map(x => x.key)),
    s3: computePopulationCounts(studentsForCharts, RUBRIC.s3.map(x => x.key)),
    s4: computePopulationCounts(studentsForCharts, RUBRIC.s4.map(x => x.key))
  };
  
  // Determine chart title based on active filters
  let chartTitleSuffix = "";
  if (filterState.classFilter !== "") {
    chartTitleSuffix = ` (${filterState.classFilter})`;
  } else if (filterState.searchQuery !== "") {
    chartTitleSuffix = " (Filtered)";
  } else if (filterState.gradeMin !== "" || filterState.gradeMax !== "" || 
             (filterState.standardFilter !== "" && filterState.standardRating !== "")) {
    chartTitleSuffix = " (Filtered)";
  }
  
  // Create pie charts for each standard
  const chartsRow = makeEl("div", { class:"grid2", style:"margin-bottom:24px;" }, [
    makeEl("div", { class:"card" }, [
      makeEl("div", { class:"sectionTitle", style:"font-size:14px; margin-bottom:8px;" }, [`Standard 1: Movement Skills${chartTitleSuffix}`]),
      makeEl("div", { style:"display:flex; justify-content:center;" }, [
        (() => {
          const canvas = document.createElement("canvas");
          canvas.width = 300; canvas.height = 220;
          drawDonutCounts(canvas, standardDistributions.s1, "Score Distribution");
          return canvas;
        })()
      ])
    ]),
    makeEl("div", { class:"card" }, [
      makeEl("div", { class:"sectionTitle", style:"font-size:14px; margin-bottom:8px;" }, [`Standard 2: Movement Concepts${chartTitleSuffix}`]),
      makeEl("div", { style:"display:flex; justify-content:center;" }, [
        (() => {
          const canvas = document.createElement("canvas");
          canvas.width = 300; canvas.height = 220;
          drawDonutCounts(canvas, standardDistributions.s2, "Score Distribution");
          return canvas;
        })()
      ])
    ]),
    makeEl("div", { class:"card" }, [
      makeEl("div", { class:"sectionTitle", style:"font-size:14px; margin-bottom:8px;" }, [`Standard 3: Health and Fitness${chartTitleSuffix}`]),
      makeEl("div", { style:"display:flex; justify-content:center;" }, [
        (() => {
          const canvas = document.createElement("canvas");
          canvas.width = 300; canvas.height = 220;
          drawDonutCounts(canvas, standardDistributions.s3, "Score Distribution");
          return canvas;
        })()
      ])
    ]),
    makeEl("div", { class:"card" }, [
      makeEl("div", { class:"sectionTitle", style:"font-size:14px; margin-bottom:8px;" }, [`Standard 4: Teamwork and Leadership${chartTitleSuffix}`]),
      makeEl("div", { style:"display:flex; justify-content:center;" }, [
        (() => {
          const canvas = document.createElement("canvas");
          canvas.width = 300; canvas.height = 220;
          drawDonutCounts(canvas, standardDistributions.s4, "Score Distribution");
          return canvas;
        })()
      ])
    ])
  ]);
  
  // Create student table with expandable rows for score entry
  const table = makeEl("table", { id:"allStudentsTable", class:"table", style:"width:100%;" });
  const thead = makeEl("thead");
  thead.appendChild(makeEl("tr", {}, [
    makeEl("th", { style:"width:20px;" }, [""]),
    makeEl("th", {}, ["Student Email"]),
    makeEl("th", {}, ["Overall Grade"]),
    makeEl("th", {}, ["Std 1"]),
    makeEl("th", {}, ["Std 2"]),
    makeEl("th", {}, ["Std 3"]),
    makeEl("th", {}, ["Std 4"]),
    makeEl("th", {}, ["Honor Code"]),
    makeEl("th", {}, ["Classes"]),
    makeEl("th", {}, ["Last Updated"])
  ]));
  table.appendChild(thead);
  
  const tbody = makeEl("tbody", { id: "allStudentsTableBody" });
  
  // Function to update table rows without re-rendering entire view (for search input)
  const updateStudentTable = () => {
    const tbodyEl = $("allStudentsTableBody");
    if (!tbodyEl) return;
    
    // Re-apply filters with current state
    const newFiltered = applyFilters(studentsWithData);
    const newSorted = [...newFiltered].sort((a, b) => 
      (a.email || "").localeCompare(b.email || "")
    );
    
    // Clear existing rows
    tbodyEl.innerHTML = "";
    
    // Rebuild rows
    for (const student of newSorted){
      const overall = computeOverallGrade(student);
      const s1 = computeStandardAverage(RUBRIC.s1, student);
      const s2 = computeStandardAverage(RUBRIC.s2, student);
      const s3 = computeStandardAverage(RUBRIC.s3, student);
      const s4 = computeStandardAverage(RUBRIC.s4, student);
      
      const updatedAt = student.updatedAt ? new Date(student.updatedAt).toLocaleDateString() : "—";
      
      // Create expand/collapse button
      const expandBtn = makeEl("button", {
        style:"background:none; border:none; cursor:pointer; font-size:16px; padding:4px 8px; color:var(--blue);",
        onclick: (e) => {
          e.stopPropagation();
          const detailRow = document.getElementById(`detail-${student.email}`);
          if (detailRow) {
            const isHidden = detailRow.style.display === "none";
            detailRow.style.display = isHidden ? "table-row" : "none";
            expandBtn.textContent = isHidden ? "▼" : "▶";
          }
        }
      }, ["▶"]);
      
      const row = makeEl("tr", {
        style:"cursor:pointer;",
        onclick: (e) => {
          if (e.target.tagName === "BUTTON" || e.target.closest("td[colspan]")) return;
          state.email = student.email;
          $("studentEmail").value = student.email;
          refreshRosterUI();
          state.activeTab = "scores";
          setStatus(`Loaded: ${student.email}`);
          render();
        }
      }, [
        makeEl("td", { onclick: (e) => e.stopPropagation() }, [expandBtn]),
        makeEl("td", { style:"font-weight:600; color:var(--blue);" }, [student.email || "—"]),
        makeEl("td", {}, [
          overall !== null 
            ? makeEl("span", { class:`badge ${scoreBadgeClass(Math.round(overall))}` }, [overall.toFixed(2)])
            : makeEl("span", {}, ["—"])
        ]),
        makeEl("td", {}, [
          s1 !== null 
            ? makeEl("span", { class:`badge ${scoreBadgeClass(Math.round(s1))}` }, [s1.toFixed(2)])
            : makeEl("span", {}, ["—"])
        ]),
        makeEl("td", {}, [
          s2 !== null 
            ? makeEl("span", { class:`badge ${scoreBadgeClass(Math.round(s2))}` }, [s2.toFixed(2)])
            : makeEl("span", {}, ["—"])
        ]),
        makeEl("td", {}, [
          s3 !== null 
            ? makeEl("span", { class:`badge ${scoreBadgeClass(Math.round(s3))}` }, [s3.toFixed(2)])
            : makeEl("span", {}, ["—"])
        ]),
        makeEl("td", {}, [
          s4 !== null 
            ? makeEl("span", { class:`badge ${scoreBadgeClass(Math.round(s4))}` }, [s4.toFixed(2)])
            : makeEl("span", {}, ["—"])
        ]),
        makeEl("td", {}, [student.honorCode ? "✓" : "—"]),
        makeEl("td", {
          onclick: (e) => e.stopPropagation(),
          style: "min-width:200px;"
        }, [
          (() => {
            const studentClasses = student.studentClasses || [];
            const isInAnyClass = studentClasses.length > 0;
            
            if (isInAnyClass) {
              return makeEl("div", { style:"display:flex; flex-wrap:wrap; gap:4px;" }, 
                studentClasses.map(className => 
                  makeEl("span", {
                    class: "badge",
                    style: "font-size:11px; padding:4px 8px; background:#e0e7ff; color:#3730a3;"
                  }, [className])
                )
              );
            } else {
              const container = makeEl("div", { style:"position:relative;" });
              const safeId = student.email.replace(/[@.]/g, "-");
              
              const dropdown = makeEl("div", {
                id: `addClassDropdown-${safeId}`,
                style: "display:none; position:absolute; top:100%; left:0; margin-top:4px; background:white; border:1px solid var(--grid-soft); border-radius:8px; padding:8px; min-width:200px; z-index:1000; box-shadow:0 4px 12px rgba(0,0,0,0.15);"
              });
              
              const addButton = makeEl("button", {
                class: "btn",
                style: "font-size:11px; padding:6px 12px; white-space:nowrap;",
                onclick: (e) => {
                  e.stopPropagation();
                  const dropdownEl = $(`addClassDropdown-${safeId}`);
                  if (dropdownEl) {
                    const isVisible = dropdownEl.style.display !== "none";
                    dropdownEl.style.display = isVisible ? "none" : "block";
                  }
                }
              }, ["➕ Add to Class"]);
              
              // Filter to only show compatible classes
              const compatibleClasses = getCompatibleClasses(student.email);
              
              if (compatibleClasses.length > 0) {
                dropdown.appendChild(makeEl("div", {
                  style: "font-weight:600; font-size:12px; margin-bottom:8px; color:var(--muted);"
                }, ["Add to existing class:"]));
                
                compatibleClasses.forEach(cls => {
                  const classOption = makeEl("button", {
                    type: "button",
                    style: "width:100%; text-align:left; padding:8px; margin-bottom:4px; background:#f9fafb; border:1px solid var(--grid-soft); border-radius:6px; cursor:pointer; font-size:12px; transition:all 0.2s;",
                    onmouseenter: (e) => e.target.style.background = "#f3f4f6",
                    onmouseleave: (e) => e.target.style.background = "#f9fafb",
                    onclick: (e) => {
                      e.stopPropagation();
                      try {
                        ensureStudent(student.email);
                        addStudentToClass(student.email, cls.name);
                        setStatus(`Added ${student.email} to ${cls.name}`);
                        dropdown.style.display = "none";
                        render();
                      } catch (err) {
                        showError("Unable to Add Student", `Failed to add "${student.email}" to class "${cls.name}".`, err.message);
                      }
                    }
                  }, [cls.name]);
                  dropdown.appendChild(classOption);
                });
              }
              
              dropdown.appendChild(makeEl("div", {
                style: "border-top:1px solid var(--grid-soft); margin-top:8px; padding-top:8px;"
              }, [
                makeEl("div", {
                  style: "font-weight:600; font-size:12px; margin-bottom:8px; color:var(--muted);"
                }, ["Create new class:"]),
                makeEl("div", { style:"display:flex; gap:4px;" }, [
                  makeEl("input", {
                    id: `newClassName-${safeId}`,
                    type: "text",
                    class: "input",
                    placeholder: "Class name",
                    style: "flex:1; padding:6px; font-size:12px;",
                    onkeypress: (e) => {
                      if (e.key === "Enter") {
                        const input = e.target;
                        const className = input.value.trim();
                        if (className) {
                          try {
                            const currentTeacherEmail = state.loggedInUser || teacherEmail;
                            if (!currentTeacherEmail && (state.userRole === "student" || !state.isTeacher)) {
                              showError("Cannot Create Class", "Only teachers and admins can create classes.", "Please contact an administrator to create a class.").then(() => {});
                              return;
                            }
                            addClass(className, currentTeacherEmail);
                            ensureStudent(student.email);
                            // Check if student matches class requirements (if class has grade/gender set)
                            const classData = loadClasses();
                            const newClass = classData.classes[className];
                            if (newClass) {
                              const check = checkStudentClassMatch(student.email, className);
                              if (!check.match) {
                                const errorMsg = check.errors.join("\n");
                                showConfirm("Class Requirements Mismatch", `This student does not match the class requirements:`, errorMsg + "\n\nDo you still want to add them?").then(confirmed => {
                                  if (!confirmed) return;
                                  addStudentToClass(student.email, className);
                                  setStatus(`Created class "${className}" and added ${student.email}`);
                                  dropdown.style.display = "none";
                                  input.value = "";
                                  render();
                                });
                                return;
                              }
                            }
                            addStudentToClass(student.email, className);
                            setStatus(`Created class "${className}" and added ${student.email}`);
                            dropdown.style.display = "none";
                            input.value = "";
                            render();
                          } catch (err) {
                            showError("Unable to Create Class", `Failed to create class "${className}" and add student.`, err.message).then(() => {});
                          }
                        }
                      }
                    }
                  }),
                  makeEl("button", {
                    class: "btn",
                    style: "font-size:11px; padding:6px 12px;",
                    onclick: (e) => {
                      e.stopPropagation();
                      const input = $(`newClassName-${safeId}`);
                      if (input) {
                        const className = input.value.trim();
                        if (className) {
                          try {
                            const currentTeacherEmail = state.loggedInUser || teacherEmail;
                            if (!currentTeacherEmail && (state.userRole === "student" || !state.isTeacher)) {
                              showError("Cannot Create Class", "Only teachers and admins can create classes.", "Please contact an administrator to create a class.").then(() => {});
                              return;
                            }
                            addClass(className, currentTeacherEmail);
                            ensureStudent(student.email);
                            // Check if student matches class requirements (if class has grade/gender set)
                            const classData = loadClasses();
                            const newClass = classData.classes[className];
                            if (newClass) {
                              const check = checkStudentClassMatch(student.email, className);
                              if (!check.match) {
                                const errorMsg = check.errors.join("\n");
                                showConfirm("Class Requirements Mismatch", `This student does not match the class requirements:`, errorMsg + "\n\nDo you still want to add them?").then(confirmed => {
                                  if (!confirmed) return;
                                  addStudentToClass(student.email, className);
                                  setStatus(`Created class "${className}" and added ${student.email}`);
                                  dropdown.style.display = "none";
                                  input.value = "";
                                  render();
                                });
                                return;
                              }
                            }
                            addStudentToClass(student.email, className);
                            setStatus(`Created class "${className}" and added ${student.email}`);
                            dropdown.style.display = "none";
                            input.value = "";
                            render();
                          } catch (err) {
                            showError("Unable to Create Class", `Failed to create class "${className}" and add student.`, err.message).then(() => {});
                          }
                        }
                      }
                    }
                  }, ["Create"])
                ])
              ]));
              
              container.appendChild(addButton);
              container.appendChild(dropdown);
              
              setTimeout(() => {
                const closeHandler = (e) => {
                  if (!container.contains(e.target) && e.target !== addButton) {
                    dropdown.style.display = "none";
                    document.removeEventListener("click", closeHandler);
                  }
                };
                document.addEventListener("click", closeHandler);
              }, 100);
              
              return container;
            }
          })()
        ]),
        makeEl("td", { class:"muted", style:"font-size:12px;" }, [updatedAt])
      ]);
      
      row.addEventListener("mouseenter", () => {
        row.style.backgroundColor = "#f9fafb";
      });
      row.addEventListener("mouseleave", () => {
        row.style.backgroundColor = "";
      });
      
      tbodyEl.appendChild(row);
    }
    
    // Update count message
    const countEl = $("allStudentsCount");
    if (countEl) {
      countEl.textContent = `Showing ${newSorted.length} of ${allStudents.length} student${allStudents.length !== 1 ? "s" : ""}. Click ▶ to expand and enter scores for each standard. Click on a student row to view detailed data.`;
    }
  };
  
  // Make updateStudentTable available globally for search input
  window.updateStudentTable = updateStudentTable;
  
  // Also make allStudents available for the dropdown click handler
  window.allStudentsForSearch = allStudents;
  
  for (const student of sortedStudents){
    const overall = computeOverallGrade(student);
    const s1 = computeStandardAverage(RUBRIC.s1, student);
    const s2 = computeStandardAverage(RUBRIC.s2, student);
    const s3 = computeStandardAverage(RUBRIC.s3, student);
    const s4 = computeStandardAverage(RUBRIC.s4, student);
    
    const updatedAt = student.updatedAt ? new Date(student.updatedAt).toLocaleDateString() : "—";
    
    // Create expand/collapse button
    const expandBtn = makeEl("button", {
      style:"background:none; border:none; cursor:pointer; font-size:16px; padding:4px 8px; color:var(--blue);",
      onclick: (e) => {
        e.stopPropagation();
        const detailRow = document.getElementById(`detail-${student.email}`);
        if (detailRow) {
          const isHidden = detailRow.style.display === "none";
          detailRow.style.display = isHidden ? "table-row" : "none";
          expandBtn.textContent = isHidden ? "▼" : "▶";
        }
      }
    }, ["▶"]);
    
    const row = makeEl("tr", {
      style:"cursor:pointer;",
      onclick: (e) => {
        // Don't navigate if clicking on expand button or detail row
        if (e.target.tagName === "BUTTON" || e.target.closest("td[colspan]")) return;
        state.email = student.email;
        $("studentEmail").value = student.email;
        refreshRosterUI();
        state.activeTab = "scores";
        setStatus(`Loaded: ${student.email}`);
        render();
      }
    }, [
      makeEl("td", {
        onclick: (e) => e.stopPropagation()
      }, [expandBtn]),
      makeEl("td", { style:"font-weight:600; color:var(--blue);" }, [student.email || "—"]),
      makeEl("td", {}, [
        overall !== null 
          ? makeEl("span", { class:`badge ${scoreBadgeClass(Math.round(overall))}` }, [overall.toFixed(2)])
          : makeEl("span", {}, ["—"])
      ]),
      makeEl("td", {}, [
        s1 !== null 
          ? makeEl("span", { class:`badge ${scoreBadgeClass(Math.round(s1))}` }, [s1.toFixed(2)])
          : makeEl("span", {}, ["—"])
      ]),
      makeEl("td", {}, [
        s2 !== null 
          ? makeEl("span", { class:`badge ${scoreBadgeClass(Math.round(s2))}` }, [s2.toFixed(2)])
          : makeEl("span", {}, ["—"])
      ]),
      makeEl("td", {}, [
        s3 !== null 
          ? makeEl("span", { class:`badge ${scoreBadgeClass(Math.round(s3))}` }, [s3.toFixed(2)])
          : makeEl("span", {}, ["—"])
      ]),
      makeEl("td", {}, [
        s4 !== null 
          ? makeEl("span", { class:`badge ${scoreBadgeClass(Math.round(s4))}` }, [s4.toFixed(2)])
          : makeEl("span", {}, ["—"])
      ]),
      makeEl("td", {}, [student.honorCode ? "✓" : "—"]),
      makeEl("td", {
        onclick: (e) => e.stopPropagation(),
        style: "min-width:200px;"
      }, [
        (() => {
          const studentClasses = student.studentClasses || [];
          const isInAnyClass = studentClasses.length > 0;
          
          if (isInAnyClass) {
            // Show classes student is in
            return makeEl("div", { style:"display:flex; flex-wrap:wrap; gap:4px;" }, 
              studentClasses.map(className => 
                makeEl("span", {
                  class: "badge",
                  style: "font-size:11px; padding:4px 8px; background:#e0e7ff; color:#3730a3;"
                }, [className])
              )
            );
          } else {
            // Show "Add to Class" button for students not in any class
            const container = makeEl("div", { style:"position:relative;" });
            const safeId = student.email.replace(/[@.]/g, "-");
            
            const dropdown = makeEl("div", {
              id: `addClassDropdown-${safeId}`,
              style: "display:none; position:absolute; top:100%; left:0; margin-top:4px; background:white; border:1px solid var(--grid-soft); border-radius:8px; padding:8px; min-width:200px; z-index:1000; box-shadow:0 4px 12px rgba(0,0,0,0.15);"
            });
            
            const addButton = makeEl("button", {
              class: "btn",
              style: "font-size:11px; padding:6px 12px; white-space:nowrap;",
              onclick: (e) => {
                e.stopPropagation();
                const dropdownEl = $(`addClassDropdown-${safeId}`);
                if (dropdownEl) {
                  const isVisible = dropdownEl.style.display !== "none";
                  dropdownEl.style.display = isVisible ? "none" : "block";
                }
              }
            }, ["➕ Add to Class"]);
            
            // Option to add to existing class - filter to only compatible classes
            const compatibleClasses = getCompatibleClasses(student.email);
            
            if (compatibleClasses.length > 0) {
              dropdown.appendChild(makeEl("div", {
                style: "font-weight:600; font-size:12px; margin-bottom:8px; color:var(--muted);"
              }, ["Add to existing class:"]));
              
              compatibleClasses.forEach(cls => {
                const classOption = makeEl("button", {
                  type: "button",
                  style: "width:100%; text-align:left; padding:8px; margin-bottom:4px; background:#f9fafb; border:1px solid var(--grid-soft); border-radius:6px; cursor:pointer; font-size:12px; transition:all 0.2s;",
                  onmouseenter: (e) => e.target.style.background = "#f3f4f6",
                  onmouseleave: (e) => e.target.style.background = "#f9fafb",
                    onclick: (e) => {
                      e.stopPropagation();
                      try {
                        ensureStudent(student.email);
                        addStudentToClass(student.email, cls.name);
                        setStatus(`Added ${student.email} to ${cls.name}`);
                        dropdown.style.display = "none";
                        render();
                      } catch (err) {
                        showError("Unable to Add Student", `Failed to add "${student.email}" to class "${cls.name}".`, err.message).then(() => {});
                      }
                    }
                }, [cls.name]);
                dropdown.appendChild(classOption);
              });
            }
            
            // Option to create new class
            dropdown.appendChild(makeEl("div", {
              style: "border-top:1px solid var(--grid-soft); margin-top:8px; padding-top:8px;"
            }, [
              makeEl("div", {
                style: "font-weight:600; font-size:12px; margin-bottom:8px; color:var(--muted);"
              }, ["Create new class:"]),
              makeEl("div", { style:"display:flex; gap:4px;" }, [
                makeEl("input", {
                  id: `newClassName-${safeId}`,
                  type: "text",
                  class: "input",
                  placeholder: "Class name",
                  style: "flex:1; padding:6px; font-size:12px;",
                  onkeypress: (e) => {
                    if (e.key === "Enter") {
                      const input = e.target;
                      const className = input.value.trim();
                      if (className) {
                        try {
                          const currentTeacherEmail = state.loggedInUser || teacherEmail;
                          if (!currentTeacherEmail && (state.userRole === "student" || !state.isTeacher)) {
                            showError("Cannot Create Class", "Only teachers and admins can create classes.", "Please contact an administrator to create a class.").then(() => {});
                            return;
                          }
                          addClass(className, currentTeacherEmail);
                          ensureStudent(student.email);
                          addStudentToClass(student.email, className);
                          setStatus(`Created class "${className}" and added ${student.email}`);
                          dropdown.style.display = "none";
                          input.value = "";
                          render();
                        } catch (err) {
                          showError("Operation Failed", "Unable to complete the operation.", err.message).then(() => {});
                        }
                      }
                    }
                  }
                }),
                makeEl("button", {
                  class: "btn",
                  style: "font-size:11px; padding:6px 12px;",
                  onclick: (e) => {
                    e.stopPropagation();
                    const input = $(`newClassName-${safeId}`);
                    if (input) {
                      const className = input.value.trim();
                      if (className) {
                        try {
                          const currentTeacherEmail = state.loggedInUser || teacherEmail;
                          if (!currentTeacherEmail && (state.userRole === "student" || !state.isTeacher)) {
                            showError("Cannot Create Class", "Only teachers and admins can create classes.", "Please contact an administrator to create a class.").then(() => {});
                            return;
                          }
                          addClass(className, currentTeacherEmail);
                          ensureStudent(student.email);
                          addStudentToClass(student.email, className);
                          setStatus(`Created class "${className}" and added ${student.email}`);
                          dropdown.style.display = "none";
                          input.value = "";
                          render();
                        } catch (err) {
                          showError("Operation Failed", "Unable to complete the operation.", err.message).then(() => {});
                        }
                      }
                    }
                  }
                }, ["Create"])
              ])
            ]));
            
            container.appendChild(addButton);
            container.appendChild(dropdown);
            
            // Close dropdown when clicking outside
            setTimeout(() => {
              const closeHandler = (e) => {
                if (!container.contains(e.target) && e.target !== addButton) {
                  dropdown.style.display = "none";
                  document.removeEventListener("click", closeHandler);
                }
              };
              document.addEventListener("click", closeHandler);
            }, 100);
            
            return container;
          }
        })()
      ]),
      makeEl("td", { class:"muted", style:"font-size:12px;" }, [updatedAt])
    ]);
    
    // Add hover effect
    row.addEventListener("mouseenter", () => {
      row.style.backgroundColor = "#f9fafb";
    });
    row.addEventListener("mouseleave", () => {
      row.style.backgroundColor = "";
    });
    
    tbody.appendChild(row);
    
    // Create expandable detail row with score inputs for each standard
    const detailRow = makeEl("tr", {
      id: `detail-${student.email}`,
      style:"display:none; background:#f9fafb;"
    });
    
    const detailCell = makeEl("td", {
      colspan: "9",
      style:"padding:16px;",
      onclick: (e) => e.stopPropagation()
    });
    
    // Create sections for each standard
    const standardsContainer = makeEl("div", { style:"display:grid; grid-template-columns: repeat(2, 1fr); gap:16px;" });
    
    // Standard 1
    const s1Section = makeEl("div", { class:"card", style:"padding:12px;" }, [
      makeEl("div", { class:"sectionTitle", style:"font-size:14px; margin-bottom:12px;" }, ["Standard 1: Movement Skills"]),
      ...RUBRIC.s1.map(item => {
        const studentVal = student?.student?.scores?.[item.key] ?? null;
        const teacherVal = student?.teacher?.scores?.[item.key] ?? null;
        const teacherNote = student?.teacher?.notes?.[item.key] ?? "";
        const studentProof = student?.student?.proofs?.[item.key] ?? "";
        
        const container = makeEl("div", { style:"margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--grid-soft);" });
        const label = makeEl("div", { style:"font-size:12px; font-weight:600; margin-bottom:6px; color:var(--ink);" }, [
          `${item.unit}: ${item.concept}`
        ]);
        
        // Student Score (read-only display)
        const studentScoreLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:8px; color:var(--muted);" }, ["Student Rating:"]);
        const studentScoreDisplay = makeEl("div", { style:"display:flex; align-items:center; gap:8px; margin-bottom:8px;" }, [
          studentVal !== null 
            ? badge(studentVal)
            : makeEl("span", { style:"color:var(--muted);" }, ["—"])
        ]);
        
        // Teacher Score input
        const teacherScoreLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:8px; color:var(--muted);" }, ["Teacher Score:"]);
        const input = scoreSelect(teacherVal, (v) => {
          updateStudent(student.email, (r) => { r.teacher.scores[item.key] = v; });
          render();
        }, false, `${student.email}-${item.key}`);
        input.style.width = "100%";
        
        // Student proof (read-only for teachers)
        const studentProofLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:12px; color:var(--muted);" }, ["Student Notes (Read-only):"]);
        const studentProofDisplay = makeEl("textarea", {
          class: "textarea",
          style: "min-height:60px; font-size:12px;",
          readonly: true,
          disabled: true
        });
        studentProofDisplay.value = studentProof || "(No student notes)";
        studentProofDisplay.style.backgroundColor = "#f9fafb";
        studentProofDisplay.style.cursor = "not-allowed";
        
        // Teacher notes (editable)
        const teacherNoteLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:12px; color:var(--muted);" }, ["Teacher Notes:"]);
        const teacherNoteInput = makeEl("textarea", {
          class: "textarea",
          style: "min-height:60px; font-size:12px;",
          placeholder: "Enter teacher notes/feedback..."
        });
        teacherNoteInput.value = teacherNote;
        teacherNoteInput.addEventListener("input", () => {
          updateStudent(student.email, (r) => { r.teacher.notes[item.key] = teacherNoteInput.value; });
        });
        
        container.appendChild(label);
        container.appendChild(studentScoreLabel);
        container.appendChild(studentScoreDisplay);
        container.appendChild(teacherScoreLabel);
        container.appendChild(input);
        container.appendChild(studentProofLabel);
        container.appendChild(studentProofDisplay);
        container.appendChild(teacherNoteLabel);
        container.appendChild(teacherNoteInput);
        return container;
      })
    ]);
    
    // Standard 2
    const s2Section = makeEl("div", { class:"card", style:"padding:12px;" }, [
      makeEl("div", { class:"sectionTitle", style:"font-size:14px; margin-bottom:12px;" }, ["Standard 2: Movement Concepts"]),
      ...RUBRIC.s2.map(item => {
        const studentVal = student?.student?.scores?.[item.key] ?? null;
        const teacherVal = student?.teacher?.scores?.[item.key] ?? null;
        const teacherNote = student?.teacher?.notes?.[item.key] ?? "";
        const studentProof = student?.student?.proofs?.[item.key] ?? "";
        
        const container = makeEl("div", { style:"margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--grid-soft);" });
        const label = makeEl("div", { style:"font-size:12px; font-weight:600; margin-bottom:6px; color:var(--ink);" }, [
          `${item.unit}: ${item.concept}`
        ]);
        
        const studentScoreLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:8px; color:var(--muted);" }, ["Student Rating:"]);
        const studentScoreDisplay = makeEl("div", { style:"display:flex; align-items:center; gap:8px; margin-bottom:8px;" }, [
          studentVal !== null 
            ? badge(studentVal)
            : makeEl("span", { style:"color:var(--muted);" }, ["—"])
        ]);
        
        const teacherScoreLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:8px; color:var(--muted);" }, ["Teacher Score:"]);
        const input = scoreSelect(teacherVal, (v) => {
          updateStudent(student.email, (r) => { r.teacher.scores[item.key] = v; });
          render();
        }, false, `${student.email}-${item.key}`);
        input.style.width = "100%";
        
        const studentProofLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:12px; color:var(--muted);" }, ["Student Notes (Read-only):"]);
        const studentProofDisplay = makeEl("textarea", {
          class: "textarea",
          style: "min-height:60px; font-size:12px;",
          readonly: true,
          disabled: true
        });
        studentProofDisplay.value = studentProof || "(No student notes)";
        studentProofDisplay.style.backgroundColor = "#f9fafb";
        studentProofDisplay.style.cursor = "not-allowed";
        
        const teacherNoteLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:12px; color:var(--muted);" }, ["Teacher Notes:"]);
        const teacherNoteInput = makeEl("textarea", {
          class: "textarea",
          style: "min-height:60px; font-size:12px;",
          placeholder: "Enter teacher notes/feedback..."
        });
        teacherNoteInput.value = teacherNote;
        teacherNoteInput.addEventListener("input", () => {
          updateStudent(student.email, (r) => { r.teacher.notes[item.key] = teacherNoteInput.value; });
        });
        
        container.appendChild(label);
        container.appendChild(studentScoreLabel);
        container.appendChild(studentScoreDisplay);
        container.appendChild(teacherScoreLabel);
        container.appendChild(input);
        container.appendChild(studentProofLabel);
        container.appendChild(studentProofDisplay);
        container.appendChild(teacherNoteLabel);
        container.appendChild(teacherNoteInput);
        return container;
      })
    ]);
    
    // Standard 3
    const s3Section = makeEl("div", { class:"card", style:"padding:12px;" }, [
      makeEl("div", { class:"sectionTitle", style:"font-size:14px; margin-bottom:12px;" }, ["Standard 3: Health and Fitness"]),
      ...RUBRIC.s3.map(item => {
        const studentVal = student?.student?.scores?.[item.key] ?? null;
        const teacherVal = student?.teacher?.scores?.[item.key] ?? null;
        const teacherNote = student?.teacher?.notes?.[item.key] ?? "";
        const studentProof = student?.student?.proofs?.[item.key] ?? "";
        
        const container = makeEl("div", { style:"margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--grid-soft);" });
        const label = makeEl("div", { style:"font-size:12px; font-weight:600; margin-bottom:6px; color:var(--ink);" }, [
          `${item.unit}: ${item.concept}`
        ]);
        
        const studentScoreLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:8px; color:var(--muted);" }, ["Student Rating:"]);
        const studentScoreDisplay = makeEl("div", { style:"display:flex; align-items:center; gap:8px; margin-bottom:8px;" }, [
          studentVal !== null 
            ? badge(studentVal)
            : makeEl("span", { style:"color:var(--muted);" }, ["—"])
        ]);
        
        const teacherScoreLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:8px; color:var(--muted);" }, ["Teacher Score:"]);
        const input = scoreSelect(teacherVal, (v) => {
          updateStudent(student.email, (r) => { r.teacher.scores[item.key] = v; });
          render();
        }, false, `${student.email}-${item.key}`);
        input.style.width = "100%";
        
        const studentProofLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:12px; color:var(--muted);" }, ["Student Notes (Read-only):"]);
        const studentProofDisplay = makeEl("textarea", {
          class: "textarea",
          style: "min-height:60px; font-size:12px;",
          readonly: true,
          disabled: true
        });
        studentProofDisplay.value = studentProof || "(No student notes)";
        studentProofDisplay.style.backgroundColor = "#f9fafb";
        studentProofDisplay.style.cursor = "not-allowed";
        
        const teacherNoteLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:12px; color:var(--muted);" }, ["Teacher Notes:"]);
        const teacherNoteInput = makeEl("textarea", {
          class: "textarea",
          style: "min-height:60px; font-size:12px;",
          placeholder: "Enter teacher notes/feedback..."
        });
        teacherNoteInput.value = teacherNote;
        teacherNoteInput.addEventListener("input", () => {
          updateStudent(student.email, (r) => { r.teacher.notes[item.key] = teacherNoteInput.value; });
        });
        
        container.appendChild(label);
        container.appendChild(studentScoreLabel);
        container.appendChild(studentScoreDisplay);
        container.appendChild(teacherScoreLabel);
        container.appendChild(input);
        container.appendChild(studentProofLabel);
        container.appendChild(studentProofDisplay);
        container.appendChild(teacherNoteLabel);
        container.appendChild(teacherNoteInput);
        return container;
      })
    ]);
    
    // Standard 4
    const s4Section = makeEl("div", { class:"card", style:"padding:12px;" }, [
      makeEl("div", { class:"sectionTitle", style:"font-size:14px; margin-bottom:12px;" }, ["Standard 4: Teamwork and Leadership"]),
      ...RUBRIC.s4.map(item => {
        const studentVal = student?.student?.scores?.[item.key] ?? null;
        const teacherVal = student?.teacher?.scores?.[item.key] ?? null;
        const teacherNote = student?.teacher?.notes?.[item.key] ?? "";
        const studentProof = student?.student?.proofs?.[item.key] ?? "";
        
        const container = makeEl("div", { style:"margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--grid-soft);" });
        const label = makeEl("div", { style:"font-size:12px; font-weight:600; margin-bottom:6px; color:var(--ink);" }, [
          `${item.unit}: ${item.concept}`
        ]);
        
        const studentScoreLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:8px; color:var(--muted);" }, ["Student Rating:"]);
        const studentScoreDisplay = makeEl("div", { style:"display:flex; align-items:center; gap:8px; margin-bottom:8px;" }, [
          studentVal !== null 
            ? badge(studentVal)
            : makeEl("span", { style:"color:var(--muted);" }, ["—"])
        ]);
        
        const teacherScoreLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:8px; color:var(--muted);" }, ["Teacher Score:"]);
        const input = scoreSelect(teacherVal, (v) => {
          updateStudent(student.email, (r) => { r.teacher.scores[item.key] = v; });
          render();
        }, false, `${student.email}-${item.key}`);
        input.style.width = "100%";
        
        const studentProofLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:12px; color:var(--muted);" }, ["Student Notes (Read-only):"]);
        const studentProofDisplay = makeEl("textarea", {
          class: "textarea",
          style: "min-height:60px; font-size:12px;",
          readonly: true,
          disabled: true
        });
        studentProofDisplay.value = studentProof || "(No student notes)";
        studentProofDisplay.style.backgroundColor = "#f9fafb";
        studentProofDisplay.style.cursor = "not-allowed";
        
        const teacherNoteLabel = makeEl("div", { style:"font-size:11px; font-weight:600; margin-bottom:4px; margin-top:12px; color:var(--muted);" }, ["Teacher Notes:"]);
        const teacherNoteInput = makeEl("textarea", {
          class: "textarea",
          style: "min-height:60px; font-size:12px;",
          placeholder: "Enter teacher notes/feedback..."
        });
        teacherNoteInput.value = teacherNote;
        teacherNoteInput.addEventListener("input", () => {
          updateStudent(student.email, (r) => { r.teacher.notes[item.key] = teacherNoteInput.value; });
        });
        
        container.appendChild(label);
        container.appendChild(studentScoreLabel);
        container.appendChild(studentScoreDisplay);
        container.appendChild(teacherScoreLabel);
        container.appendChild(input);
        container.appendChild(studentProofLabel);
        container.appendChild(studentProofDisplay);
        container.appendChild(teacherNoteLabel);
        container.appendChild(teacherNoteInput);
        return container;
      })
    ]);
    
    standardsContainer.appendChild(s1Section);
    standardsContainer.appendChild(s2Section);
    standardsContainer.appendChild(s3Section);
    standardsContainer.appendChild(s4Section);
    
    detailCell.appendChild(standardsContainer);
    detailRow.appendChild(detailCell);
    tbody.appendChild(detailRow);
  }
  
  table.appendChild(tbody);
  
  // Update rating select disabled state
  setTimeout(() => {
    const ratingSelect = $("filterRating");
    const standardSelect = $("filterStandard");
    if (ratingSelect && standardSelect) {
      ratingSelect.disabled = !standardSelect.value;
    }
  }, 0);
  
  return makeEl("div", {}, [
    makeEl("div", { class:"sectionTitle" }, ["All Students Overview"]),
    makeEl("div", { id:"allStudentsCount", class:"muted", style:"margin-bottom:20px;" }, [
      `Showing ${sortedStudents.length} of ${allStudents.length} student${allStudents.length !== 1 ? "s" : ""}. Click ▶ to expand and enter scores for each standard. Click on a student row to view detailed data.`
    ]),
    filterSection,
    makeEl("div", { class:"sectionTitle", style:"font-size:16px; margin-bottom:12px; margin-top:24px;" }, ["Score Distribution by Standard"]),
    chartsRow,
    makeEl("div", { class:"sectionTitle", style:"margin-top:24px; font-size:16px;" }, ["Student Details"]),
    makeEl("div", { style:"overflow-x:auto; margin-top:12px;" }, [table])
  ]);
}

function render(){
  buildTabs();
  refreshRosterUI();

  const view = $("view");
  view.innerHTML = "";

  if (state.activeTab === "futurePlans"){
    view.appendChild(renderFuturePlans());
    return;
  }

  // Check if current user (student or teacher) is assigned to a class
  // If not assigned, show blocking message and prevent any interaction
  if (!isCurrentUserAssigned() && (state.userRole === "student" || state.userRole === "teacher")) {
    view.appendChild(renderNotAssignedMessage());
    return;
  }

  // Update honor code checkbox from record (dashboard checkbox is updated in renderScoresAndGrades)
  const record = state.email ? getStudent(state.email) : null;

  // Admin Panel
  if (state.activeTab === "admin" && state.userRole === "admin"){
    view.appendChild(renderAdminPanel());
    return;
  }

  // Manage Classes view - for teachers only
  if (state.activeTab === "manageClasses" && (state.isTeacher || state.userRole === "teacher" || state.userRole === "admin")){
    view.appendChild(renderManageClasses());
    return;
  }
  
  // All Students view - accessible without selecting a student
  // All Students view - in teacher mode, default to this if no student selected
  if (state.activeTab === "allStudents" || ((state.isTeacher || state.userRole === "teacher") && !state.email)){
    if ((state.isTeacher || state.userRole === "teacher") && !state.email && state.activeTab !== "allStudents") {
      state.activeTab = "allStudents";
    }
    view.appendChild(renderAllStudents());
    return;
  }

  if (!state.email){
    if (state.userRole === "parent") {
      const children = getParentChildren(state.loggedInUser);
      if (children.length === 0) {
        view.appendChild(makeEl("div", { class:"card" }, [
          makeEl("div", { class:"sectionTitle" }, ["No Children Registered"]),
          makeEl("div", { class:"muted" }, [
            "You don't have any children registered. Please contact an administrator to add your children to your account."
          ]),
        ]));
      } else {
        view.appendChild(makeEl("div", { class:"card" }, [
          makeEl("div", { class:"sectionTitle" }, ["Select a Child"]),
          makeEl("div", { class:"muted" }, [
            "Please select one of your children from the dropdown above to view their assessment data."
          ]),
        ]));
      }
    } else {
      view.appendChild(makeEl("div", { class:"card" }, [
        makeEl("div", { class:"sectionTitle" }, ["Start"]),
        makeEl("div", { class:"muted" }, [
          state.isTeacher 
            ? "Select a student or type an email, then click Load / Create. Or use the 'All Students' tab to view all students at once."
            : "Select a student or type an email, then click Load / Create."
        ]),
      ]));
    }
    return;
  }
  
  // For parents, verify they can only see their children's data
  if (state.userRole === "parent") {
    const children = getParentChildren(state.loggedInUser);
    if (!children.includes(state.email.toLowerCase())) {
      view.appendChild(makeEl("div", { class:"card" }, [
        makeEl("div", { class:"sectionTitle" }, ["Access Denied"]),
        makeEl("div", { class:"muted" }, [
          "You can only view data for your registered children. Please select a child from the dropdown."
        ]),
      ]));
      return;
    }
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

function renderFuturePlans(){
  const wrap = makeEl("div", { style:"max-width:760px; margin:0 auto; padding-bottom:40px;" });

  // Header
  wrap.appendChild(makeEl("div", { class:"card", style:"margin-bottom:20px; padding:28px 32px; background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%); color:white; border-radius:14px;" }, [
    makeEl("div", { style:"font-size:22px; font-weight:800; margin-bottom:6px;" }, ["MICDS MS P.E. Assessment — Roadmap"]),
    makeEl("div", { style:"font-size:14px; opacity:0.8; line-height:1.6;" }, ["This page outlines what the app does today and the features planned for future development."]),
  ]));

  const phases = [
    {
      label: "Current Demo", done: true, color: "#16a34a",
      items: [
        "Email/password login with @micds.org enforcement",
        "Four PE standards: Movement Skills, Movement Concepts, Health & Fitness, Teamwork & Leadership",
        "1–4 self-assessment scoring rubric (matched to MICDS assessment sheet)",
        "Teacher override scores with reassessment unlocking at score 1–2",
        "Approach to Learning (ATL): effort, focus, days late/unprepared",
        "Class management — create classes, assign students, filter by grade/gender",
        "All-students view with per-standard charts for teachers",
        "Admin panel: manage students, teachers, classes, and users",
        "Parent portal — view linked children's scores",
        "Export/import JSON backups",
      ],
    },
    {
      label: "Phase 2 — Live Backend", done: false, color: "#1e40af",
      items: [
        "Firebase Authentication with Google Sign-in (@micds.org enforced)",
        "Firestore real-time database — data syncs instantly across all devices",
        "Teacher sees student updates the moment they are submitted",
        "Secure Firestore rules so students cannot edit teacher scores",
        "Deploy to Netlify/Vercel with automatic HTTPS",
      ],
    },
    {
      label: "Phase 3 — Reporting", done: false, color: "#7c3aed",
      items: [
        "One-click PDF report card export per student",
        "Printable class rosters with full score summaries",
        "Semester-to-semester progress tracking",
        "Per-class analytics: score distributions, improvement trends",
      ],
    },
    {
      label: "Phase 4 — Integrations", done: false, color: "#b45309",
      items: [
        "Google Classroom integration for syncing assignments",
        "Email/push notifications to parents when scores are published",
        "MICDS Student Information System (SIS) roster import",
        "Advanced parent portal with historical grade access",
      ],
    },
  ];

  phases.forEach(phase => {
    const card = makeEl("div", { class:"card", style:"margin-bottom:16px; padding:20px 24px;" });

    const header = makeEl("div", { style:"display:flex; align-items:center; gap:12px; margin-bottom:14px;" });
    header.appendChild(makeEl("div", {
      style:`width:10px; height:10px; border-radius:50%; background:${phase.color}; flex-shrink:0; margin-top:2px;`
    }));
    header.appendChild(makeEl("div", { style:`font-size:16px; font-weight:700; color:${phase.color};` }, [phase.label]));
    if (phase.done) {
      header.appendChild(makeEl("div", { style:"margin-left:auto; font-size:12px; font-weight:700; color:#16a34a; background:#dcfce7; border-radius:999px; padding:2px 10px;" }, ["Working now"]));
    }
    card.appendChild(header);

    const list = makeEl("ul", { style:"margin:0; padding-left:20px; display:flex; flex-direction:column; gap:6px;" });
    phase.items.forEach(item => {
      list.appendChild(makeEl("li", { style:`font-size:14px; color:var(--ink); line-height:1.5; list-style-type:${phase.done ? '"✓  "' : '"○  "'};` }, [item]));
    });
    card.appendChild(list);
    wrap.appendChild(card);
  });

  return wrap;
}

// Initialize default users in admin DB if they don't exist
function initializeDefaultUsers(){
  const db = loadAdminDB();
  let needsSave = false;
  
  // Ensure admin exists
  if (!db.admins.includes("admin@micds.org")) {
    db.admins.push("admin@micds.org");
    needsSave = true;
  }
  
  // Add default teachers if they don't exist
  TEACHER_EMAILS.forEach(email => {
    const e = email.trim().toLowerCase();
    if (!db.teachers.includes(e)) {
      db.teachers.push(e);
      needsSave = true;
    }
  });
  
  // Add default students if they don't exist
  STUDENT_EMAILS.forEach(email => {
    const e = email.trim().toLowerCase();
    if (!db.students.includes(e)) {
      db.students.push(e);
      needsSave = true;
    }
  });
  
  if (needsSave) {
    saveAdminDB(db);
    console.log("Initialized default users in admin DB");
  }
}

export function initApp(){
  console.log("initApp called");
  
  // Initialize default users first
  initializeDefaultUsers();
  
  // Check for existing session
  const savedUser = sessionStorage.getItem("loggedInUser");
  const savedRole = sessionStorage.getItem("userRole");
  const savedIsTeacher = sessionStorage.getItem("isTeacher");
  
  if (savedUser && savedRole){
    console.log("Found saved session:", savedUser, savedRole);
    state.loggedInUser = savedUser;
    state.userRole = savedRole;
    state.isTeacher = savedIsTeacher === "true";
    
    // For students, auto-load their own data
    if (savedRole === "student"){
      state.email = savedUser;
      ensureStudent(state.email);
    }
    
    showMainApp();
  initTopbar();
  refreshRosterUI();
  buildTabs();
  render();
    setStatus(`Logged in as ${savedRole}: ${savedUser}`);
  } else {
    console.log("No saved session, showing login page");
    // Ensure login page is visible
    showLoginPage();
    // Initialize login form handlers - try multiple times if needed
    let attempts = 0;
    const tryInit = () => {
      attempts++;
      console.log(`Attempting to initialize login (attempt ${attempts})`);
      const loginForm = $("loginForm");
      if (loginForm) {
        console.log("Login form found, initializing...");
        initLogin();
      } else if (attempts < 5) {
        console.log("Login form not found, retrying...");
        setTimeout(tryInit, 200);
      } else {
        console.error("Login form not found after 5 attempts");
        showError("Login Error", "The login form could not be found.", "Please refresh the page and try again.");
      }
    };
    tryInit();
  }
}

// Helper function to initialize math and science classes with students
export function initializeMathAndScienceClasses(teacherEmail = "prosen@micds.org"){
  try {
    // Get all students from hardcoded list and ensure they exist
    const allStudentEmails = [...STUDENT_EMAILS];
    
    // Ensure all students exist in the database
    allStudentEmails.forEach(email => {
      ensureStudent(email);
    });
    
    // Create math class
    addClass("math", teacherEmail);
    
    // Create science class
    addClass("science", teacherEmail);
    
    // Split students in half
    const midpoint = Math.ceil(allStudentEmails.length / 2);
    const mathStudents = allStudentEmails.slice(0, midpoint);
    const scienceStudents = allStudentEmails.slice(midpoint);
    
    // Assign students to math class
    mathStudents.forEach(email => {
      try {
        addStudentToClass(email, "math");
      } catch (e) {
        console.error(`Error adding ${email} to math:`, e);
      }
    });
    
    // Assign students to science class
    scienceStudents.forEach(email => {
      try {
        addStudentToClass(email, "science");
      } catch (e) {
        console.error(`Error adding ${email} to science:`, e);
      }
    });
    
    console.log("Classes initialized:");
    console.log("Math class:", mathStudents);
    console.log("Science class:", scienceStudents);
    
    return {
      math: mathStudents,
      science: scienceStudents
    };
  } catch (error) {
    console.error("Error initializing classes:", error);
    throw error;
  }
}

window.addEventListener("DOMContentLoaded", ()=> {
         initApp();
         
         // Auto-initialize math and science classes if they don't exist
         setTimeout(() => {
           const teacherEmail = state.loggedInUser;
           if (teacherEmail && (state.isTeacher || state.userRole === "teacher" || state.userRole === "admin")) {
             const classes = getClassesForTeacher(teacherEmail);
             const hasMath = classes.some(c => c.name === "math");
             const hasScience = classes.some(c => c.name === "science");
             
             if (!hasMath || !hasScience) {
               console.log("Initializing math and science classes...");
               initializeMathAndScienceClasses(teacherEmail);
               // Refresh UI if we're on the manage classes tab
               if (state.activeTab === "manageClasses") {
                 render();
               }
             }
           }
         }, 1500);
});

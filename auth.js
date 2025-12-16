const TEACHER_WHITELIST = [
  "prosen@micds.org"
];

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginErr = document.getElementById("login-error");

function showLogin(msg){
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app").classList.add("hidden");
  if (msg){
    loginErr.textContent = msg;
    loginErr.classList.remove("hidden");
  } else {
    loginErr.classList.add("hidden");
  }
}
function showApp(){
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
}

loginBtn.onclick = async () => {
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
  } catch (e){
    showLogin(e?.message || "Login failed");
  }
};

logoutBtn.onclick = () => firebase.auth().signOut();

firebase.auth().onAuthStateChanged(async (user) => {
  if (!user){
    showLogin();
    return;
  }
  const email = (user.email || "").toLowerCase();

  if (!email.endsWith("@micds.org")){
    await firebase.auth().signOut();
    showLogin("MICDS accounts only (@micds.org).");
    return;
  }

  const role = TEACHER_WHITELIST.includes(email) ? "Teacher" : "Student";

  showApp();
  await startAppUI({ viewerEmail: email, role });
});

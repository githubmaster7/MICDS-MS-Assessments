// auth.js

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("login-btn");
  const loginError = document.getElementById("login-error");

  if (!loginBtn) {
    console.error("Login button not found");
    return;
  }

  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();

  loginBtn.onclick = async () => {
    try {
      await auth.signInWithPopup(provider);
    } catch (err) {
      console.error(err);
      loginError.textContent = err.message;
      loginError.classList.remove("hidden");
    }
  };
});

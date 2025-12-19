console.log("auth.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded");

  const loginBtn = document.getElementById("login-btn");
  console.log("loginBtn =", loginBtn);

  if (!loginBtn) {
    console.error("LOGIN BUTTON NOT FOUND");
    return;
  }

  loginBtn.addEventListener("click", () => {
    console.log("LOGIN BUTTON CLICKED");
  });
});

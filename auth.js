// auth.js

document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("login-btn");
  const loginError = document.getElementById("login-error");

  const auth = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();

  // When user clicks login → REDIRECT (not popup)
  loginBtn.addEventListener("click", () => {
    auth.signInWithRedirect(provider);
  });

  // Handle redirect result
  auth.getRedirectResult()
    .then((result) => {
      if (result.user) {
        console.log("Signed in:", result.user.email);
      }
    })
    .catch((error) => {
      console.error(error);
      loginError.textContent = error.message;
      loginError.classList.remove("hidden");
    });
});

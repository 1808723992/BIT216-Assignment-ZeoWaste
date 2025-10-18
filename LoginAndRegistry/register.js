function togglePassword(id) {
  const input = document.getElementById(id);
  const icon = input.nextElementSibling.querySelector("i");

  if (input.type === "password") {
    input.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
}

// Animate logo circle size on scroll
window.addEventListener("scroll", () => {
  const circle = document.querySelector(".dot-circle");
  if (!circle) return;

  const scrollY = window.scrollY;
  const scale = Math.max(1, 1 + scrollY / 500); // grows smoothly
  circle.style.transform = `scale(${scale})`;
});
// === Logo Scroll Animation ===

// Select the circle
const dotsCircle = document.querySelector('.dots-circle');

// Only run if the logo section exists
if (dotsCircle) {
  window.addEventListener('scroll', () => {
    let scale = 1 + window.scrollY / 600; // grow as you scroll
    if (scale < 1) scale = 1;
    if (scale > 2) scale = 2; // set max size
    dotsCircle.style.transform = `scale(${scale})`;
  });
}

// ✅ Password validation with smooth visual feedback
const passwordInput = document.getElementById("password");
const passwordHint = document.getElementById("password-hint");
const form = document.querySelector(".register-form");

passwordInput.addEventListener("input", () => {
  const value = passwordInput.value;
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;

  if (regex.test(value)) {
    passwordHint.classList.remove("invalid");
    passwordHint.classList.add("valid");
    passwordHint.innerHTML = `<i class="fa fa-check-circle"></i> Strong password!`;
  } else {
    passwordHint.classList.remove("valid");
    passwordHint.classList.add("invalid");
    passwordHint.innerHTML = `<i class="fa fa-exclamation-circle"></i> Must include at least 8 characters, one uppercase, one lowercase, and one symbol.`;
  }
});

// ✅ Prevent form submission if password invalid
form.addEventListener("submit", (event) => {
  const value = passwordInput.value;
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;

  if (!regex.test(value)) {
    event.preventDefault();
    passwordHint.classList.add("invalid");
    passwordHint.innerHTML = `<i class="fa fa-exclamation-circle"></i> Password does not meet the required strength.`;
    alert("❌ Password does not meet the required strength!");
  }
});

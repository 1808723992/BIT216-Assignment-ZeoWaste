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

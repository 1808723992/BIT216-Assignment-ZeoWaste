// Toggle password visibility
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

// Switch between steps
function goToStep(step) {
  document.getElementById("step1").classList.add("hidden");
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step3").classList.add("hidden");

  document.getElementById("step" + step).classList.remove("hidden");
}

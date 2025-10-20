// =============================================
// Toggle password visibility
// =============================================
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

// =============================================
// Step switching + OTP logic
// =============================================
function goToStep(step) {
  // Step 1 → Step 2 : Send OTP
  if (step === 2) {
    const email = document.getElementById("reset-email").value;
    alert("✅ Button clicked, now sending request...");

    fetch("/BIT216-Assignment-ZeoWaste/Main/LoginAndRegistry/reset_password.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `step=send_otp&email=${encodeURIComponent(email)}`
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert("✅ OTP sent to your email.");
          document.getElementById("step1").classList.add("hidden");
          document.getElementById("step2").classList.remove("hidden");
        } else {
          alert("❌ " + data.message);
        }
      })
      .catch(() => alert("❌ Failed to send OTP. Please try again."));
    return;
  }

  // Step 2 → Step 3 : Verify OTP
  if (step === 3) {
    const email = document.getElementById("reset-email").value;
    const otp = document.getElementById("otp").value;

    fetch("/BIT216-Assignment-ZeoWaste/Main/LoginAndRegistry/reset_password.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `step=verify_otp&email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert("✅ OTP verified successfully! You can now reset your password.");
          document.getElementById("step2").classList.add("hidden");
          document.getElementById("step3").classList.remove("hidden");
        } else {
          alert("❌ " + data.message);
        }
      })
      .catch(() => alert("❌ Verification failed. Please try again."));
    return;
  }

  // Hide all steps (generic)
  document.getElementById("step1").classList.add("hidden");
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step3").classList.add("hidden");
  document.getElementById("step" + step).classList.remove("hidden");
}

// =============================================
// Step 3 : Final Reset Password submission
// =============================================
document.getElementById("step3").addEventListener("submit", function (e) {
  e.preventDefault(); // Stop form reload

  const email = document.getElementById("reset-email").value;
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;

  if (newPassword !== confirmPassword) {
    alert("❌ Passwords do not match!");
    return;
  }

  fetch("/BIT216-Assignment-ZeoWaste/Main/LoginAndRegistry/reset_password.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `step=update_password&email=${encodeURIComponent(email)}&new_password=${encodeURIComponent(newPassword)}`
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert("✅ Password reset successful! You can now sign in with your new password.");
        window.location.href = "/BIT216-Assignment-ZeoWaste/Main/sign_in.html"; // redirect to sign in page
      } else {
        alert("❌ " + data.message);
      }
    })
    .catch(() => alert("❌ Server error while resetting password."));
});

// =============================================
// Password strength validation (Step 3)
// =============================================
const newPasswordInput = document.getElementById("new-password");
const passwordHint = document.getElementById("password-hint");
const step3Form = document.getElementById("step3");

if (newPasswordInput && passwordHint && step3Form) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;

  // live feedback
  newPasswordInput.addEventListener("input", () => {
    const value = newPasswordInput.value;
    if (regex.test(value)) {
      passwordHint.classList.remove("invalid");
      passwordHint.classList.add("valid");
      passwordHint.innerHTML = `<i class="fa fa-check-circle"></i> Strong password!`;
    } else {
      passwordHint.classList.remove("valid");
      passwordHint.classList.add("invalid");
      passwordHint.innerHTML = `<i class="fa fa-exclamation-circle"></i> Include at least 8 characters, one uppercase, lowercase, and symbol.`;
    }
  });

  // block weak password before submission
  step3Form.addEventListener("submit", (e) => {
    if (!regex.test(newPasswordInput.value)) {
      e.preventDefault();
      passwordHint.classList.add("invalid");
      passwordHint.innerHTML = `<i class="fa fa-exclamation-circle"></i> Password does not meet strength requirements.`;
      alert("❌ Password must include uppercase, lowercase, symbol, and at least 8 characters!");
    }
  });
}

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

    fetch("reset_password.php", {
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

    fetch("reset_password.php", {
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

  fetch("reset_password.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `step=update_password&email=${encodeURIComponent(email)}&new_password=${encodeURIComponent(newPassword)}`
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert("✅ Password reset successful! You can now sign in with your new password.");
        window.location.href = "sign_in.html"; // redirect to sign in page
      } else {
        alert("❌ " + data.message);
      }
    })
    .catch(() => alert("❌ Server error while resetting password."));
});

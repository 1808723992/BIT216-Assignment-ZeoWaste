<?php
session_start();

if (!isset($_SESSION['user_id'])) {
  header('Location: ../sign_in.html');
  exit();
}

require_once '../connect.php';

$userId = $_SESSION['user_id'];

$stmt = $conn->prepare('SELECT full_name, email, household_size FROM users WHERE user_id = ? LIMIT 1');
$stmt->bind_param('i', $userId);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$stmt->close();
$conn->close();

$displayName = $user['full_name'] ?? '';
$email = $user['email'] ?? '';
$householdSize = $user['household_size'] ?? '';
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ZeoWaste | Manage Profile</title>
    <base href="../" />
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="Homepage/nav.css" />
    <link rel="stylesheet" href="ManageProfile/manage_profile.css" />
  </head>
  <body>
    <script src="Homepage/load_nav.js"></script>

    <main class="profile-wrapper">
      <section class="profile-hero">
        <img src="HomePagePicture/zeowaste-logo.png" alt="ZeoWaste" class="brand-logo" />
        <h1>Manage Your ZeoWaste Account</h1>
        <p>Update your display name, household size, or delete your account. Password changes are handled on a dedicated page.</p>
        <div class="account-chip">
          <span class="material-symbols-outlined">mail</span>
          <span><?php echo htmlspecialchars($email); ?></span>
        </div>
      </section>

      <section class="settings-grid">
        <details class="setting-card" open>
          <summary>
            <div class="summary-left">
              <span class="summary-icon summary-icon--green material-symbols-outlined">person</span>
              <div>
                <h2>Update Display Name</h2>
                <p>Set the name that appears across ZeoWaste</p>
              </div>
            </div>
            <span class="material-symbols-outlined chevron">expand_more</span>
          </summary>
          <form id="usernameForm" class="setting-form">
            <label for="displayName">Display Name</label>
            <input
              type="text"
              id="displayName"
              name="full_name"
              value="<?php echo htmlspecialchars($displayName); ?>"
              maxlength="60"
              required
            />
            <p class="form-hint">This name is shown on dashboards and notifications.</p>
            <button type="submit" class="btn btn--green">
              <span class="material-symbols-outlined">save</span>
              Save Display Name
            </button>
            <p class="form-status" id="usernameStatus"></p>
          </form>
        </details>

        <details class="setting-card">
          <summary>
            <div class="summary-left">
              <span class="summary-icon summary-icon--blue material-symbols-outlined">lock_reset</span>
              <div>
                <h2>Change Password</h2>
                <p>Jump to the reset password flow</p>
              </div>
            </div>
            <span class="material-symbols-outlined chevron">open_in_new</span>
          </summary>
          <div class="setting-form">
            <p class="form-hint">We’ll send you to the reset password process to keep your account secure.</p>
            <a class="btn btn--outline" href="reset_password.html">
              <span class="material-symbols-outlined">arrow_forward</span>
              Go To Reset Password
            </a>
          </div>
        </details>

        <details class="setting-card">
          <summary>
            <div class="summary-left">
              <span class="summary-icon summary-icon--purple material-symbols-outlined">group</span>
              <div>
                <h2>Household Size</h2>
                <p>Adjust your household size for smarter insights</p>
              </div>
            </div>
            <span class="material-symbols-outlined chevron">expand_more</span>
          </summary>
          <form id="householdForm" class="setting-form">
            <label for="householdSize">Number of People</label>
            <input
              type="number"
              id="householdSize"
              name="household_size"
              min="1"
              max="20"
              value="<?php echo htmlspecialchars($householdSize); ?>"
              required
            />
            <p class="form-hint">We tailor inventory tips and meal planning suggestions using this number.</p>
            <button type="submit" class="btn btn--purple">
              <span class="material-symbols-outlined">save</span>
              Save Household Size
            </button>
            <p class="form-status" id="householdStatus"></p>
          </form>
        </details>

        <details class="setting-card danger-zone">
          <summary>
            <div class="summary-left">
              <span class="summary-icon summary-icon--red material-symbols-outlined">warning</span>
              <div>
                <h2>Delete Account</h2>
                <p>Remove your account and all associated data</p>
              </div>
            </div>
            <span class="material-symbols-outlined chevron">expand_more</span>
          </summary>
          <form id="deleteForm" class="setting-form">
            <div class="danger-box">
              <span class="material-symbols-outlined">report</span>
              <div>
                <strong>Warning: This action cannot be undone.</strong>
                <p>Deleting your account erases your inventories, history, and personal preferences.</p>
              </div>
            </div>
            <label for="confirmPhrase">Type <strong>DELETE</strong> to confirm</label>
            <input type="text" id="confirmPhrase" name="confirm_phrase" placeholder="DELETE" required />
            <button type="submit" class="btn btn--danger">
              <span class="material-symbols-outlined">delete_forever</span>
              Permanently Delete Account
            </button>
            <p class="form-status" id="deleteStatus"></p>
          </form>
        </details>
      </section>
    </main>

    <script>
      document.addEventListener('DOMContentLoaded', () => {
        const usernameForm = document.getElementById('usernameForm');
        const householdForm = document.getElementById('householdForm');
        const deleteForm = document.getElementById('deleteForm');

        const setStatus = (elementId, message, isSuccess) => {
          const el = document.getElementById(elementId);
          if (!el) return;
          el.textContent = message;
          el.classList.remove('is-success', 'is-error');
          el.classList.add(isSuccess ? 'is-success' : 'is-error');
        };

        if (usernameForm) {
          usernameForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(usernameForm);
            formData.append('action', 'update_name');

            try {
              const response = await fetch('ManageProfile/update_profile.php', {
                method: 'POST',
                body: formData
              });
              const data = await response.json();
              if (!response.ok || !data.success) {
                throw new Error(data.message || 'Update failed. Please try again shortly.');
              }
              setStatus('usernameStatus', data.message, true);
            } catch (error) {
              setStatus('usernameStatus', error.message, false);
            }
          });
        }

        if (householdForm) {
          householdForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(householdForm);
            formData.append('action', 'update_household');

            try {
              const response = await fetch('ManageProfile/update_profile.php', {
                method: 'POST',
                body: formData
              });
              const data = await response.json();
              if (!response.ok || !data.success) {
                throw new Error(data.message || 'Update failed. Please try again shortly.');
              }
              setStatus('householdStatus', data.message, true);
            } catch (error) {
              setStatus('householdStatus', error.message, false);
            }
          });
        }

        if (deleteForm) {
          deleteForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(deleteForm);

            try {
              const response = await fetch('ManageProfile/delete_account.php', {
                method: 'POST',
                body: formData
              });
              const data = await response.json();
              if (!response.ok || !data.success) {
                throw new Error(data.message || 'Deletion failed. Please try again shortly.');
              }
              setStatus('deleteStatus', data.message, true);
              setTimeout(() => {
                window.location.href = data.redirect || 'sign_in.html';
              }, 1500);
            } catch (error) {
              setStatus('deleteStatus', error.message, false);
            }
          });
        }

        document.querySelectorAll('.setting-card').forEach((details) => {
          details.addEventListener('toggle', () => {
            const chevron = details.querySelector('.chevron');
            if (chevron) {
              chevron.textContent = details.open ? 'expand_less' : chevron.dataset.defaultIcon || 'expand_more';
            }
          });

          const chevron = details.querySelector('.chevron');
          if (chevron && !chevron.dataset.defaultIcon) {
            chevron.dataset.defaultIcon = chevron.textContent;
          }
        });
      });
    </script>
  </body>
</html>


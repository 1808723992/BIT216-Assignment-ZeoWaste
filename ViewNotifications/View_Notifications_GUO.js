const API_BASE = 'ViewNotifications/backend/notifications_api.php';

let notifications = [];
let currentFilter = 'all';
let selectedNotifications = new Set();
let activeNotificationId = null;

window.archiveSelectedNotifications = archiveSelectedNotifications;
window.moveSelectedToTrash = moveSelectedToTrash;
window.unarchiveSelectedNotifications = unarchiveSelectedNotifications;
window.moveArchiveToTrash = moveArchiveToTrash;
window.restoreSelectedNotifications = restoreSelectedNotifications;
window.permanentlyDeleteSelectedNotifications = permanentlyDeleteSelectedNotifications;

document.addEventListener('DOMContentLoaded', () => {
  initializeDate();
  setupEventListeners();
  refreshData();
});

function initializeDate() {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const dateElement = document.getElementById('current-date');
  if (dateElement) {
    dateElement.textContent = dateStr;
  }
}

function setupEventListeners() {
  const markReadBtn = document.querySelector('.mark-read-btn');
  if (markReadBtn) {
    markReadBtn.addEventListener('click', markAllAsRead);
  }

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', async function () {
      const filter = this.dataset.filter;
      if (filter && filter !== currentFilter) {
        await setActiveFilter(filter);
      }
    });
  });

  const selectAllCheckbox = document.getElementById('select-all');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', function () {
      toggleSelectAll(this.checked);
    });
  }

  document.addEventListener('click', async function (e) {
    const notificationItem = e.target.closest('.notification-item');
    if (notificationItem && !e.target.closest('.notification-checkbox')) {
      const notificationId = parseInt(notificationItem.dataset.id, 10);
      await handleNotificationClick(notificationId);
    }
  });

  document.addEventListener('change', function (e) {
    if (!e.target.classList.contains('notification-checkbox')) {
      return;
    }
    const item = e.target.closest('.notification-item');
    if (!item) return;
    const notificationId = parseInt(item.dataset.id, 10);
    if (Number.isNaN(notificationId)) return;

    if (e.target.checked) {
      selectedNotifications.add(notificationId);
    } else {
      selectedNotifications.delete(notificationId);
    }
    updateSelectAllCheckbox();
    updateActionButtons();
  });

  updateActionButtons();
}

async function setActiveFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.filter === filter) {
      item.classList.add('active');
    }
  });

  activeNotificationId = null;
  selectedNotifications.clear();
  updateSelectAllCheckbox();
  updateActionButtons();
  showPlaceholder();

  await refreshData();
}

function updateTrashHint() {
  const hint = document.getElementById('trash-hint');
  if (!hint) return;
  hint.style.display = currentFilter === 'trash' ? 'block' : 'none';
}

async function refreshData() {
  try {
    await Promise.all([
      refreshCounts(),
      loadNotifications(currentFilter)
    ]);
  } catch (error) {
    console.error('Failed to refresh notifications', error);
  }

  renderNotifications();
  updateSelectAllCheckbox();
  updateActionButtons();
}

async function loadNotifications(filter) {
  const url = `${API_BASE}?filter=${encodeURIComponent(filter)}`;
  try {
    const data = await fetchJson(url);
    notifications = (data.data || []).map(transformNotification);
  } catch (error) {
    console.error('Failed to load notifications', error);
    notifications = [];
  }
}

function renderNotifications() {
  const notificationList = document.getElementById('notification-list');
  if (!notificationList) return;

  notificationList.innerHTML = '';

  if (notifications.length === 0) {
    showEmptyState(notificationList);
    updateNotificationCount();
    updateTrashHint();
    return;
  }

  notifications.forEach(notif => {
    notificationList.appendChild(createNotificationElement(notif));
  });

  updateNotificationCount();
  updateTrashHint();
}

function showEmptyState(container) {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';

  let message = 'No unread notifications';
  if (currentFilter === 'all') {
    message = 'No notifications';
  } else if (currentFilter === 'archived') {
    message = 'No archived notifications';
  } else if (currentFilter === 'trash') {
    message = 'Trash is empty';
  } else if (currentFilter === 'expired') {
    message = 'No expired notifications';
  } else if (currentFilter === 'expiring-soon') {
    message = 'No expiring soon notifications';
  } else if (currentFilter === 'meal-plans') {
    message = 'No meal plan notifications';
  } else if (currentFilter === 'donations') {
    message = 'No donation notifications';
  }

  emptyState.innerHTML = `
    <div class="empty-state-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M9 12l2 2 4-4"></path>
      </svg>
    </div>
    <div class="empty-state-title">No New Notifications</div>
    <div class="empty-state-message">${message}</div>
  `;

  container.appendChild(emptyState);
}

function createNotificationElement(notif) {
  const div = document.createElement('div');
  div.className = `notification-item ${notif.read ? 'read' : ''}`;
  div.dataset.type = notif.type;
  div.dataset.id = notif.id;
  div.dataset.read = String(notif.read);

  if (selectedNotifications.has(notif.id) || activeNotificationId === notif.id) {
    div.classList.add('selected');
  }

  let iconSvg = '';
  if (notif.type === 'expired') {
    iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`;
  } else if (notif.type === 'expiring-soon') {
    iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff8800" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>`;
  } else if (notif.type === 'meal-plans') {
    iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9b59b6" stroke-width="2">
      <path d="M6 2v20"></path>
      <path d="M6 2l1.5 1.5 1.5-1.5"></path>
      <path d="M6 6l1.5 1.5 1.5-1.5"></path>
      <path d="M6 10l1.5 1.5 1.5-1.5"></path>
      <path d="M18 2v20"></path>
      <path d="M18 2l-1.5 1.5-1.5-1.5"></path>
      <path d="M18 6l-1.5 1.5-1.5-1.5"></path>
      <line x1="6" y1="12" x2="18" y2="12"></line>
    </svg>`;
  } else if (notif.type === 'donations') {
    iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff69b4" stroke-width="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>`;
  } else if (notif.type === 'new-food') {
    iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>`;
  } else {
    iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3498db" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12" y2="16"></line>
    </svg>`;
  }

  let tagClass = '';
  let tagText = '';
  if (notif.type === 'expired') {
    tagClass = 'tag-expired';
    tagText = 'Expired';
  } else if (notif.type === 'expiring-soon') {
    tagClass = 'tag-expiring';
    tagText = 'Expiring Soon';
  } else if (notif.type === 'meal-plans') {
    tagClass = 'tag-mealplan';
    tagText = 'Meal Plan';
  } else if (notif.type === 'donations') {
    tagClass = 'tag-donation';
    tagText = 'Donation';
  } else if (notif.type === 'new-food') {
    tagClass = 'tag-newfood';
    tagText = 'New Food';
  }

  const dateLabel = notif.type === 'meal-plans' ? 'Meal Date' : 'Created';

  div.innerHTML = `
    <input type="checkbox" class="notification-checkbox" ${selectedNotifications.has(notif.id) ? 'checked' : ''}>
    <div class="notification-icon ${notif.type}-icon">
      ${iconSvg}
    </div>
    <div class="notification-content">
      <div class="notification-header-row">
        <h3 class="notification-title">${notif.title}</h3>
        <span class="notification-tag ${tagClass}">${tagText}</span>
      </div>
      <p class="notification-subtitle">${notif.subtitle}</p>
      <p class="notification-description">${notif.message}</p>
      <div class="notification-meta">
        <span class="notification-date">${dateLabel}: ${notif.date}</span>
        <span class="notification-time">${notif.time}</span>
      </div>
      ${!notif.read ? '<div class="notification-status-dot"></div>' : ''}
    </div>
  `;

  return div;
}

function showNotificationDetails(notification) {
  const notif = typeof notification === 'number'
    ? notifications.find(n => n.id === notification)
    : notification;
  if (!notif) return;

  const detailsPanel = document.getElementById('notification-details');
  if (!detailsPanel) return;

  const placeholder = detailsPanel.querySelector('.details-placeholder');
  const allDetails = detailsPanel.querySelectorAll('.details-content');
  if (placeholder) placeholder.style.display = 'none';
  allDetails.forEach(detail => detail.style.display = 'none');

  if (notif.type === 'expired') {
    showExpiredDetails(notif);
  } else if (notif.type === 'expiring-soon') {
    showExpiringSoonDetails(notif);
  } else if (notif.type === 'meal-plans') {
    showMealPlanDetails(notif);
  } else if (notif.type === 'donations') {
    showDonationDetails(notif);
  } else if (notif.type === 'new-food') {
    showNewFoodDetails(notif);
  } else {
    if (placeholder) placeholder.style.display = 'flex';
  }

  document.querySelectorAll('.notification-item').forEach(item => {
    item.classList.remove('selected');
    if (parseInt(item.dataset.id, 10) === notif.id) {
      item.classList.add('selected');
    }
  });
}

function showExpiredDetails(notif) {
  const detailsExpired = document.getElementById('details-expired');
  if (!detailsExpired) return;
  const payload = notif.payload || {};

  setText('details-expired-time', formatDateTime(notif.createdAt));
  setText('details-expired-name', notif.subtitle || payload.foodName || 'Unknown item');
  setText('details-expired-date', formatDate(payload.expiryDate) || '—');
  setText('details-expired-subtext', formatExpiredSubtext(payload.expiryDate));
  setText('details-expired-location', payload.storageLocation || 'Unknown location');
  setText('details-expired-message', notif.message || '');

  detailsExpired.style.display = 'flex';
}

function showDonationDetails(notif) {
  const detailsDonation = document.getElementById('details-donation');
  if (!detailsDonation) return;
  const payload = notif.payload || {};

  setText('details-donation-title', notif.title || 'Donation Update');
  setText('details-donation-time', formatDateTime(notif.createdAt));
  setText('details-donation-name', notif.subtitle || 'Food item');
  setText('details-donation-date', formatDate(payload.expiryDate), '—');
  setText('details-donation-status', payload.donationStatus || 'Pending');
  setText('details-donation-message', notif.message || '');

  const daysText = calculateDaysUntil(payload.expiryDate);
  setText('details-donation-expiry-subtext', daysText ? `Expires in ${daysText}` : '');
  setText('details-donation-location', payload.pickupLocation || payload.storageLocation || '—');

  const extra = [];
  if (payload.availability) extra.push(`Availability: ${payload.availability}`);
  if (payload.donationCreatedAt) extra.push(`Created: ${formatDateTime(payload.donationCreatedAt)}`);
  if (payload.donationCompletedAt) extra.push(`Completed: ${formatDateTime(payload.donationCompletedAt)}`);
  if (payload.donationWithdrawnAt) extra.push(`Withdrawn: ${formatDateTime(payload.donationWithdrawnAt)}`);
  setText('details-donation-donation-time', extra.join(' · '));

  detailsDonation.style.display = 'flex';
}

function showExpiringSoonDetails(notif) {
  const detailsExpiring = document.getElementById('details-expiring-soon');
  if (!detailsExpiring) return;
  const payload = notif.payload || {};

  setText('details-expiring-time', formatDateTime(notif.createdAt));
  setText('details-expiring-name', notif.subtitle || payload.foodName || 'Food item');
  setText('details-expiring-date', formatDate(payload.expiryDate));
  const days = calculateDaysUntil(payload.expiryDate);
  setText('details-expiring-subtext', days ? `Expires in ${days}` : '');
  setText('details-expiring-location', payload.storageLocation || 'Unknown location');
  setText('details-expiring-message', notif.message || '');

  detailsExpiring.style.display = 'flex';
}

function showMealPlanDetails(notif) {
  const detailsMealplan = document.getElementById('details-mealplan');
  if (!detailsMealplan) return;
  const payload = notif.payload || {};

  setText('details-mealplan-time', formatDateTime(notif.createdAt));
  setText('details-mealplan-date', payload.mealDate || notif.date);
  setText('details-mealplan-message', notif.message || '');

  const mealsList = document.getElementById('mealplan-meals-list');
  const meals = payload.meals || [];
  if (mealsList) {
    mealsList.innerHTML = '';
    meals.forEach(meal => {
      const mealItem = document.createElement('div');
      mealItem.className = 'meal-item';

      const mealIconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9b59b6" stroke-width="2">
        <path d="M6 2v20"></path>
        <path d="M6 2l1.5 1.5 1.5-1.5"></path>
        <path d="M6 6l1.5 1.5 1.5-1.5"></path>
        <path d="M6 10l1.5 1.5 1.5-1.5"></path>
        <path d="M18 2v20"></path>
        <path d="M18 2l-1.5 1.5-1.5-1.5"></path>
        <path d="M18 6l-1.5 1.5-1.5-1.5"></path>
        <line x1="6" y1="12" x2="18" y2="12"></line>
      </svg>`;

      const ingredientsHTML = (meal.ingredients || []).map(ing => `<span class="ingredient-tag">${ing}</span>`).join('');

      mealItem.innerHTML = `
        <div class="meal-item-header">
          <div class="meal-item-icon">${mealIconSvg}</div>
          <span class="meal-item-tag">${meal.type || ''}</span>
        </div>
        <div class="meal-item-title">${meal.name || ''}</div>
        <div class="meal-item-ingredients">
          <span class="ingredients-label">Required Ingredients</span>
          <div class="ingredients-list">${ingredientsHTML}</div>
        </div>
      `;

      mealsList.appendChild(mealItem);
    });
  }

  detailsMealplan.style.display = 'flex';
}

function showNewFoodDetails(notif) {
  const detailsNewFood = document.getElementById('details-new-food');
  if (!detailsNewFood) return;
  const payload = notif.payload || {};

  setText('details-newfood-time', formatDateTime(notif.createdAt));
  setText('details-newfood-name', notif.subtitle || 'Food item');
  setText('details-newfood-date', formatDate(payload.expiryDate), '—');
  const days = calculateDaysUntil(payload.expiryDate);
  setText('details-newfood-subtext', days ? `Expires in ${days}` : '');
  setText('details-newfood-location', payload.storageLocation || '—');
  setText('details-newfood-message', notif.message || '');

  detailsNewFood.style.display = 'flex';
}

function setText(elementId, text, fallback = '') {
  const el = document.getElementById(elementId);
  if (!el) return;
  const value = text !== undefined && text !== null && text !== '' ? text : fallback;
  el.textContent = value;
}

function showPlaceholder() {
  const detailsPanel = document.getElementById('notification-details');
  if (!detailsPanel) return;
  const placeholder = detailsPanel.querySelector('.details-placeholder');
  const allDetails = detailsPanel.querySelectorAll('.details-content');

  if (placeholder) placeholder.style.display = 'flex';
  allDetails.forEach(detail => detail.style.display = 'none');

  activeNotificationId = null;
  document.querySelectorAll('.notification-item').forEach(item => item.classList.remove('selected'));
}

async function markAllAsRead() {
  const unreadIds = notifications.filter(notif => notif.status === 'unread').map(notif => notif.id);
  if (unreadIds.length === 0) return;
  const ok = await mutateNotifications('mark-read', unreadIds);
  if (ok) {
    showPlaceholder();
  }
}

function toggleSelectAll(checked) {
  if (checked) {
    notifications.forEach(notif => selectedNotifications.add(notif.id));
  } else {
    selectedNotifications.clear();
  }
  renderNotifications();
  updateActionButtons();
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all');
  if (!selectAllCheckbox) return;

  const checkedCount = notifications.filter(notif => selectedNotifications.has(notif.id)).length;
  selectAllCheckbox.checked = checkedCount > 0 && checkedCount === notifications.length;
  selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < notifications.length;
}

function updateNotificationCount() {
  const countElement = document.getElementById('notification-count');
  if (countElement) {
    countElement.textContent = notifications.length;
  }
}

async function refreshCounts() {
  try {
    const data = await fetchJson(`${API_BASE}?action=counts`);
    updateBadge('all', data.all ?? 0);
    updateBadge('unread', data.unread ?? 0);
    updateBadge('expired', data.expired ?? 0);
    updateBadge('expiring-soon', data.expiringSoon ?? 0);
    updateBadge('meal-plans', data.mealPlans ?? 0);
    updateBadge('donations', data.donations ?? 0);
    updateBadge('archived', data.archived ?? 0);
    updateBadge('trash', data.trash ?? 0);
  } catch (error) {
    console.error('Failed to fetch counts', error);
  }
}

function updateBadge(filter, count) {
  const navItem = document.querySelector(`[data-filter="${filter}"]`);
  if (!navItem) return;
  const badge = navItem.querySelector('.badge');
  if (!badge) return;

  badge.textContent = count;
  if (filter === 'all' && count > 0) {
    badge.className = 'badge badge-green';
  } else if (count > 0) {
    badge.className = 'badge badge-grey';
  } else {
    badge.className = 'badge';
  }
}

function updateActionButtons() {
  const actionButtons = document.getElementById('action-buttons');
  const normalButtons = document.getElementById('normal-action-buttons');
  const archiveButtons = document.getElementById('archive-action-buttons');
  const trashButtons = document.getElementById('trash-action-buttons');

  if (!actionButtons) return;

  if (normalButtons) normalButtons.style.display = 'none';
  if (archiveButtons) archiveButtons.style.display = 'none';
  if (trashButtons) trashButtons.style.display = 'none';

  if (selectedNotifications.size === 0) {
    actionButtons.style.display = 'none';
    return;
  }

  actionButtons.style.display = 'flex';
  if (currentFilter === 'archived') {
    if (archiveButtons) archiveButtons.style.display = 'flex';
  } else if (currentFilter === 'trash') {
    if (trashButtons) trashButtons.style.display = 'flex';
  } else {
    if (normalButtons) normalButtons.style.display = 'flex';
  }
}

async function archiveSelectedNotifications() {
  const ids = Array.from(selectedNotifications);
  if (ids.length === 0) return;
  const ok = await mutateNotifications('archive', ids);
  if (ok) showPlaceholder();
}

async function moveSelectedToTrash() {
  const ids = Array.from(selectedNotifications);
  if (ids.length === 0) return;
  const ok = await mutateNotifications('trash', ids);
  if (ok) showPlaceholder();
}

async function unarchiveSelectedNotifications() {
  const ids = Array.from(selectedNotifications);
  if (ids.length === 0) return;
  const ok = await mutateNotifications('mark-read', ids);
  if (ok) showPlaceholder();
}

async function moveArchiveToTrash() {
  const ids = Array.from(selectedNotifications);
  if (ids.length === 0) return;
  const ok = await mutateNotifications('trash', ids);
  if (ok) showPlaceholder();
}

async function restoreSelectedNotifications() {
  const ids = Array.from(selectedNotifications);
  if (ids.length === 0) return;
  const ok = await mutateNotifications('restore', ids);
  if (ok) showPlaceholder();
}

async function permanentlyDeleteSelectedNotifications() {
  const ids = Array.from(selectedNotifications);
  if (ids.length === 0) return;

  const message = ids.length === 1
    ? 'Are you sure you want to permanently delete this notification? This action cannot be undone.'
    : `Are you sure you want to permanently delete ${ids.length} notifications? This action cannot be undone.`;
  if (!confirm(message)) return;

  const ok = await mutateNotifications('delete', ids);
  if (ok) showPlaceholder();
}

async function handleNotificationClick(id) {
  const notif = notifications.find(n => n.id === id);
  if (!notif) return;

  activeNotificationId = id;
  selectedNotifications.clear();
  updateActionButtons();
  updateSelectAllCheckbox();

  const snapshot = { ...notif };

  if (notif.status === 'unread') {
    const ok = await mutateNotifications('mark-read', [id], { refresh: false });
    if (ok) {
      notif.status = 'read';
      notif.read = true;
      snapshot.status = 'read';
      snapshot.read = true;
      await refreshCounts();
      if (currentFilter === 'unread') {
        await loadNotifications(currentFilter);
      }
      renderNotifications();
    }
  }

  showNotificationDetails(snapshot);
}

async function mutateNotifications(action, ids, { refresh = true } = {}) {
  if (!ids || ids.length === 0) {
    return true;
  }

  try {
    const response = await fetch(`${API_BASE}?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    });

    if (!response.ok) {
      const errorData = await safeJson(response);
      throw new Error(errorData?.error || `Request failed: ${response.status}`);
    }

    const result = await safeJson(response);
    if (result && result.error) {
      throw new Error(result.error);
    }

    selectedNotifications.clear();
    if (refresh) {
      activeNotificationId = null;
      await refreshData();
    }
    return true;
  } catch (error) {
    console.error(`Failed to perform ${action}`, error);
    alert('Operation failed. Please try again.');
    return false;
  }
}

function transformNotification(record) {
  const typeMap = {
    'donation': 'donations'
  };

  const rawType = record.type || 'other';
  const type = typeMap[rawType] || rawType;
  const createdAt = record.created_at || record.createdAt;
  let payload = record.payload;
  if (payload && typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (error) {
      payload = {};
    }
  }

  return {
    id: record.notification_id,
    type,
    status: record.status,
    title: record.title || '',
    subtitle: record.subtitle || '',
    message: record.message || '',
    payload: payload || {},
    createdAt,
    updatedAt: record.updated_at || null,
    read: record.status !== 'unread',
    date: formatDate(createdAt),
    time: formatRelativeTime(createdAt)
  };
}

function formatDate(dateLike) {
  if (!dateLike) return '';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return dateLike;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTime(dateLike) {
  if (!dateLike) return '';
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return dateLike;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatRelativeTime(dateLike) {
  if (!dateLike) return '';
  const now = Date.now();
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = now - date.getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 60) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateLike);
}

function calculateDaysUntil(dateLike) {
  if (!dateLike) return '';
  const target = new Date(dateLike);
  if (Number.isNaN(target.getTime())) return '';
  const today = new Date();
  const diffTime = target.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > 0) return `${diffDays} day(s)`;
  if (diffDays === 0) return '0 day(s)';
  return `${Math.abs(diffDays)} day(s) ago`;
}

function formatExpiredSubtext(expiryDate) {
  if (!expiryDate) return '';
  const text = calculateDaysUntil(expiryDate);
  if (!text) return '';
  if (text.includes('ago')) {
    return `Expired ${text.replace(' day(s) ago', '')} day(s) ago`;
  }
  return `Expires in ${text}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const data = await safeJson(response);
  if (data === null) {
    throw new Error('Invalid JSON response');
  }
  return data;
}

async function safeJson(response) {
  try {
    return await response.clone().json();
  } catch (error) {
    return null;
  }
}


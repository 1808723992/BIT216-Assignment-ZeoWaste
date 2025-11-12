// Notification Data Structure
const notificationsData = [
  {
    id: 1,
    type: 'expired',
    title: 'Food Expired',
    subtitle: 'Whole Milk',
    description: 'Your milk has expired, please handle it immediately',
    date: '2025-11-01',
    time: '9h ago',
    read: false,
    expiryDate: '2025-11-01',
    storageLocation: 'Refrigerator - 2nd Shelf',
    alertTime: '11/5/2025, 8:00:00 AM',
    expiredDaysAgo: 4
  },
  {
    id: 2,
    type: 'expiring-soon',
    title: 'Food Expiring Soon',
    subtitle: 'Fresh Eggs (12 pack)',
    description: 'Your eggs will expire in 2 days',
    date: '2025-11-07',
    time: '9h ago',
    read: false,
    expiryDate: '2025-11-07',
    storageLocation: 'Refrigerator - 1st Shelf',
    alertTime: '11/5/2025, 7:30:00 AM',
    daysUntilExpiry: 2
  },
  {
    id: 3,
    type: 'meal-plans',
    title: 'Tomorrow\'s Meal Plan Reminder',
    subtitle: 'Full Day Meal Plan',
    description: 'Tomorrow\'s meal plan is ready, including breakfast, lunch, dinner, and midnight snack',
    date: '2025-11-06',
    time: '4h ago',
    read: false,
    mealDate: '2025-11-06',
    alertTime: '11/5/2025, 9:00:00 PM',
    meals: [
      {
        type: 'Breakfast',
        name: 'Oatmeal with Fruits',
        ingredients: ['Oats', 'Banana', 'Blueberries', 'Honey', 'Almonds']
      },
      {
        type: 'Lunch',
        name: 'Chicken Breast Salad',
        ingredients: ['Chicken Breast', 'Lettuce', 'Tomatoes', 'Cucumber', 'Olive Oil']
      },
      {
        type: 'Dinner',
        name: 'Pasta with Tomato Sauce',
        ingredients: ['Pasta', 'Tomatoes', 'Onion', 'Garlic', 'Basil']
      },
      {
        type: 'Midnight Snack',
        name: 'Fruit Yogurt Parfait',
        ingredients: ['Yogurt', 'Oats', 'Strawberries', 'Blueberries', 'Crushed Nuts']
      }
    ]
  },
  {
    id: 4,
    type: 'donations',
    title: 'Donation Published Successfully',
    subtitle: 'Organic Apples',
    description: 'Your food donation has been published, waiting for confirmation',
    date: '2025-11-10',
    time: '7h ago',
    read: false,
    expiryDate: '2025-11-10',
    status: 'Pending',
    alertTime: '11/5/2025, 10:00:00 AM',
    donationLocation: 'Community Food Bank - 123 Zhongshan Road',
    donationTime: '2025-11-06 14:00-16:00',
    daysUntilExpiry: 2
  },
  {
    id: 5,
    type: 'donations',
    title: 'Donation Confirmed',
    subtitle: 'Whole Wheat Bread',
    description: 'Your donation has been confirmed, thank you for your kindness',
    date: '2025-11-08',
    time: '4d ago',
    read: false,
    expiryDate: '2025-11-08',
    status: 'Confirmed',
    alertTime: '11/1/2025, 10:00:00 AM'
  },
  {
    id: 6,
    type: 'expired',
    title: 'Food Expired',
    subtitle: 'Yogurt',
    description: 'Your yogurt has expired, please handle it immediately',
    date: '2025-11-02',
    time: '1d ago',
    read: false,
    expiryDate: '2025-11-02',
    storageLocation: 'Refrigerator - 3rd Shelf',
    alertTime: '11/4/2025, 9:00:00 AM',
    expiredDaysAgo: 3
  },
  {
    id: 7,
    type: 'expiring-soon',
    title: 'Food Expiring Soon',
    subtitle: 'Bananas',
    description: 'Your bananas will expire in 1 day',
    date: '2025-11-06',
    time: '5h ago',
    read: false,
    expiryDate: '2025-11-06',
    storageLocation: 'Counter Top'
  },
  {
    id: 8,
    type: 'meal-plans',
    title: 'Weekly Meal Plan Ready',
    subtitle: 'Weekly Meal Plan',
    description: 'Your weekly meal plan is ready',
    date: '2025-11-07',
    time: '2h ago',
    read: true,
    mealDate: '2025-11-07'
  },
  {
    id: 9,
    type: 'donations',
    title: 'Donation Completed',
    subtitle: 'Fresh Vegetables',
    description: 'Your donation has been completed successfully',
    date: '2025-11-09',
    time: '1d ago',
    read: false,
    expiryDate: '2025-11-09',
    status: 'Completed',
    alertTime: '11/4/2025, 2:00:00 PM'
  },
  {
    id: 10,
    type: 'expired',
    title: 'Food Expired',
    subtitle: 'Cheese',
    description: 'Your cheese has expired, please handle it immediately',
    date: '2025-10-30',
    time: '6d ago',
    read: true,
    expiryDate: '2025-10-30',
    storageLocation: 'Refrigerator - 1st Shelf',
    alertTime: '10/30/2025, 8:00:00 AM',
    expiredDaysAgo: 6
  },
  {
    id: 11,
    type: 'new-food',
    title: 'New Food Added',
    subtitle: 'Organic Apples',
    description: 'Successfully added new food to inventory',
    date: '2025-11-15',
    time: '3d ago',
    read: false,
    expiryDate: '2025-11-15',
    storageLocation: 'Refrigerator - Crisper Drawer',
    alertTime: '11/3/2025, 3:30:00 PM',
    daysUntilExpiry: 7
  }
];

// State Management
let currentFilter = 'all';
let selectedNotifications = new Set();
let archivedNotifications = new Set();
// Map to store trash notifications with their deletion timestamps (in milliseconds)
let trashNotifications = new Map(); // id -> timestamp
let permanentlyDeletedNotifications = new Set();

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  initializeDate();
  setupEventListeners();
  checkAndDeleteOldTrashNotifications(); // Check for 30-day old trash items
  updateNotificationCounts();
  renderNotifications();
});

// Check and automatically delete trash notifications older than 30 days
function checkAndDeleteOldTrashNotifications() {
  const now = Date.now();
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  let deletedCount = 0;
  
  for (const [id, timestamp] of trashNotifications.entries()) {
    if (now - timestamp > thirtyDaysInMs) {
      permanentlyDeletedNotifications.add(id);
      trashNotifications.delete(id);
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    updateNotificationCounts();
    if (currentFilter === 'trash') {
      renderNotifications();
    }
  }
}

// Periodically check for old trash notifications (every hour)
setInterval(checkAndDeleteOldTrashNotifications, 60 * 60 * 1000);

// Set current date
function initializeDate() {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const dateElement = document.getElementById('current-date');
  if (dateElement) {
    dateElement.textContent = dateStr;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Mark All as Read button
  const markReadBtn = document.querySelector('.mark-read-btn');
  if (markReadBtn) {
    markReadBtn.addEventListener('click', markAllAsRead);
  }

  // Navigation filter items
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      const filter = this.dataset.filter;
      if (filter) {
        setActiveFilter(filter);
      }
    });
  });

  // Select All checkbox
  const selectAllCheckbox = document.getElementById('select-all');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', function() {
      toggleSelectAll(this.checked);
    });
  }

  // Notification item clicks
  document.addEventListener('click', function(e) {
    const notificationItem = e.target.closest('.notification-item');
    if (notificationItem && !e.target.closest('.notification-checkbox')) {
      const notificationId = parseInt(notificationItem.dataset.id);
      selectNotification(notificationId);
      showNotificationDetails(notificationId);
    }
  });

  // Notification checkbox clicks
  document.addEventListener('change', function(e) {
    if (e.target.classList.contains('notification-checkbox')) {
      const notificationItem = e.target.closest('.notification-item');
      const notificationId = parseInt(notificationItem.dataset.id);
      if (e.target.checked) {
        selectedNotifications.add(notificationId);
      } else {
        selectedNotifications.delete(notificationId);
      }
      updateSelectAllCheckbox();
      updateActionButtons();
    }
  });

  // Update action buttons visibility on initial load
  updateActionButtons();
}

// Set active filter
function setActiveFilter(filter) {
  currentFilter = filter;
  
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.filter === filter) {
      item.classList.add('active');
    }
  });

  // Clear selections
  selectedNotifications.clear();
  updateSelectAllCheckbox();
  updateActionButtons();
  
  // Render filtered notifications
  renderNotifications();
  
  // Always show placeholder when switching filters (no notification selected)
  showPlaceholder();
}

// Render notifications based on current filter
function renderNotifications() {
  const notificationList = document.getElementById('notification-list');
  if (!notificationList) return;

  let filteredNotifications = notificationsData.filter(notif => {
    // Skip permanently deleted notifications
    if (permanentlyDeletedNotifications.has(notif.id)) {
      return false;
    }
    
    // Handle archived and trash filters
    if (currentFilter === 'archived') {
      return archivedNotifications.has(notif.id);
    }
    if (currentFilter === 'trash') {
      return trashNotifications.has(notif.id);
    }
    
    // Filter out archived and trash items for other filters
    if (archivedNotifications.has(notif.id) || trashNotifications.has(notif.id)) {
      return false;
    }

    // Apply type filters
    if (currentFilter === 'all') {
      return true;
    }
    if (currentFilter === 'unread') {
      return !notif.read;
    }
    if (currentFilter === 'expired') {
      return notif.type === 'expired';
    }
    if (currentFilter === 'expiring-soon') {
      return notif.type === 'expiring-soon';
    }
    if (currentFilter === 'meal-plans') {
      return notif.type === 'meal-plans';
    }
    if (currentFilter === 'donations') {
      return notif.type === 'donations';
    }
    return true;
  });

  // Clear existing notifications
  notificationList.innerHTML = '';

  // Show empty state if no notifications
  if (filteredNotifications.length === 0) {
    showEmptyState(notificationList);
  } else {
    // Render notifications
    filteredNotifications.forEach(notif => {
      const notificationElement = createNotificationElement(notif);
      notificationList.appendChild(notificationElement);
    });
  }

  // Update count
  updateNotificationCount();
}

// Show empty state message
function showEmptyState(container) {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  
  // Get appropriate message based on current filter
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

// Create notification element
function createNotificationElement(notif) {
  const div = document.createElement('div');
  div.className = `notification-item ${notif.read ? 'read' : ''}`;
  div.dataset.type = notif.type;
  div.dataset.id = notif.id;
  div.dataset.read = notif.read;

  if (selectedNotifications.has(notif.id)) {
    div.classList.add('selected');
  }

  // Get icon based on type
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
  }

  // Get tag
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

  // Date label
  const dateLabel = notif.type === 'meal-plans' ? 'Meal Date' : 'Expires';

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
      <p class="notification-description">${notif.description}</p>
      <div class="notification-meta">
        <span class="notification-date">${dateLabel}: ${notif.date}</span>
        <span class="notification-time">${notif.time}</span>
      </div>
      ${!notif.read ? '<div class="notification-status-dot"></div>' : ''}
    </div>
  `;

  return div;
}

// Select notification
function selectNotification(id) {
  const notif = notificationsData.find(n => n.id === id);
  if (!notif) return;

  // Mark as read
  if (!notif.read) {
    notif.read = true;
    updateNotificationCounts();
    renderNotifications();
  }
}

// Show notification details
function showNotificationDetails(id) {
  const notif = notificationsData.find(n => n.id === id);
  if (!notif) return;

  const detailsPanel = document.getElementById('notification-details');
  const placeholder = detailsPanel.querySelector('.details-placeholder');
  const allDetails = detailsPanel.querySelectorAll('.details-content');

  // Hide placeholder and all details
  if (placeholder) placeholder.style.display = 'none';
  allDetails.forEach(detail => detail.style.display = 'none');

  // Show appropriate details based on type
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
    // For other types, show placeholder or create appropriate template
    if (placeholder) placeholder.style.display = 'flex';
  }

  // Update selected notification in list
  document.querySelectorAll('.notification-item').forEach(item => {
    item.classList.remove('selected');
    if (parseInt(item.dataset.id) === id) {
      item.classList.add('selected');
    }
  });
}

// Show expired notification details
function showExpiredDetails(notif) {
  const detailsExpired = document.getElementById('details-expired');
  if (!detailsExpired) return;

  document.getElementById('details-expired-time').textContent = notif.alertTime || '11/5/2025, 8:00:00 AM';
  document.getElementById('details-expired-name').textContent = notif.subtitle;
  document.getElementById('details-expired-date').textContent = notif.expiryDate;
  document.getElementById('details-expired-subtext').textContent = `Expired ${notif.expiredDaysAgo || 4} days ago`;
  document.getElementById('details-expired-location').textContent = notif.storageLocation || 'Refrigerator - 2nd Shelf';
  document.getElementById('details-expired-message').textContent = notif.description;

  detailsExpired.style.display = 'flex';
}

// Show donation notification details
function showDonationDetails(notif) {
  const detailsDonation = document.getElementById('details-donation');
  if (!detailsDonation) return;

  document.getElementById('details-donation-title').textContent = notif.title;
  document.getElementById('details-donation-time').textContent = notif.alertTime || '11/5/2025, 8:00:00 AM';
  document.getElementById('details-donation-name').textContent = notif.subtitle;
  document.getElementById('details-donation-date').textContent = notif.expiryDate;
  document.getElementById('details-donation-status').textContent = notif.status || 'Published';
  document.getElementById('details-donation-message').textContent = notif.description;
  
  // Set additional donation fields
  if (document.getElementById('details-donation-expiry-subtext')) {
    const daysText = notif.daysUntilExpiry !== undefined ? `Expires in ${notif.daysUntilExpiry} days` : '';
    document.getElementById('details-donation-expiry-subtext').textContent = daysText;
  }
  if (document.getElementById('details-donation-location')) {
    document.getElementById('details-donation-location').textContent = notif.donationLocation || '';
  }
  if (document.getElementById('details-donation-donation-time')) {
    document.getElementById('details-donation-donation-time').textContent = notif.donationTime || '';
  }

  detailsDonation.style.display = 'flex';
}

// Show expiring soon notification details
function showExpiringSoonDetails(notif) {
  const detailsExpiring = document.getElementById('details-expiring-soon');
  if (!detailsExpiring) return;

  document.getElementById('details-expiring-time').textContent = notif.alertTime || '11/5/2025, 7:30:00 AM';
  document.getElementById('details-expiring-name').textContent = notif.subtitle;
  document.getElementById('details-expiring-date').textContent = notif.expiryDate;
  const daysText = notif.daysUntilExpiry !== undefined ? `Expires in ${notif.daysUntilExpiry} days` : 'Expires in 2 days';
  document.getElementById('details-expiring-subtext').textContent = daysText;
  document.getElementById('details-expiring-location').textContent = notif.storageLocation || 'Refrigerator - 1st Shelf';
  document.getElementById('details-expiring-message').textContent = notif.description;

  detailsExpiring.style.display = 'flex';
}

// Show meal plan notification details
function showMealPlanDetails(notif) {
  const detailsMealplan = document.getElementById('details-mealplan');
  if (!detailsMealplan) return;

  document.getElementById('details-mealplan-time').textContent = notif.alertTime || '11/5/2025, 9:00:00 PM';
  document.getElementById('details-mealplan-date').textContent = notif.mealDate || notif.date;
  document.getElementById('details-mealplan-message').textContent = notif.description;

  // Render meals list
  const mealsList = document.getElementById('mealplan-meals-list');
  if (mealsList && notif.meals && notif.meals.length > 0) {
    mealsList.innerHTML = '';
    notif.meals.forEach(meal => {
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
      
      const ingredientsHTML = meal.ingredients.map(ing => 
        `<span class="ingredient-tag">${ing}</span>`
      ).join('');
      
      mealItem.innerHTML = `
        <div class="meal-item-header">
          <div class="meal-item-icon">${mealIconSvg}</div>
          <span class="meal-item-tag">${meal.type}</span>
        </div>
        <div class="meal-item-title">${meal.name}</div>
        <div class="meal-item-ingredients">
          <span class="ingredients-label">Required Ingredients</span>
          <div class="ingredients-list">
            ${ingredientsHTML}
          </div>
        </div>
      `;
      
      mealsList.appendChild(mealItem);
    });
  }

  detailsMealplan.style.display = 'flex';
}

// Show new food notification details
function showNewFoodDetails(notif) {
  const detailsNewFood = document.getElementById('details-new-food');
  if (!detailsNewFood) return;

  document.getElementById('details-newfood-time').textContent = notif.alertTime || '11/3/2025, 3:30:00 PM';
  document.getElementById('details-newfood-name').textContent = notif.subtitle;
  document.getElementById('details-newfood-date').textContent = notif.expiryDate;
  const daysText = notif.daysUntilExpiry !== undefined ? `Expires in ${notif.daysUntilExpiry} days` : 'Expires in 7 days';
  document.getElementById('details-newfood-subtext').textContent = daysText;
  document.getElementById('details-newfood-location').textContent = notif.storageLocation || 'Refrigerator - Crisper Drawer';
  document.getElementById('details-newfood-message').textContent = notif.description;

  detailsNewFood.style.display = 'flex';
}

// Show placeholder
function showPlaceholder() {
  const detailsPanel = document.getElementById('notification-details');
  const placeholder = detailsPanel.querySelector('.details-placeholder');
  const allDetails = detailsPanel.querySelectorAll('.details-content');

  if (placeholder) placeholder.style.display = 'flex';
  allDetails.forEach(detail => detail.style.display = 'none');

  // Remove selected class from all notifications
  document.querySelectorAll('.notification-item').forEach(item => {
    item.classList.remove('selected');
  });
}

// Mark all as read
function markAllAsRead() {
  const visibleNotifications = getVisibleNotifications();
  visibleNotifications.forEach(notif => {
    notif.read = true;
  });
  updateNotificationCounts();
  renderNotifications();
  showPlaceholder();
}

// Get visible notifications based on current filter
function getVisibleNotifications() {
  return notificationsData.filter(notif => {
    if (currentFilter === 'archived') {
      return archivedNotifications.has(notif.id);
    }
    if (currentFilter === 'trash') {
      return trashNotifications.has(notif.id) && !permanentlyDeletedNotifications.has(notif.id);
    }
    if (archivedNotifications.has(notif.id) || trashNotifications.has(notif.id) || permanentlyDeletedNotifications.has(notif.id)) {
      return false;
    }
    if (currentFilter === 'all') {
      return true;
    }
    if (currentFilter === 'unread') {
      return !notif.read;
    }
    return notif.type === currentFilter;
  });
}

// Toggle select all
function toggleSelectAll(checked) {
  const visibleNotifications = getVisibleNotifications();
  if (checked) {
    visibleNotifications.forEach(notif => {
      selectedNotifications.add(notif.id);
    });
  } else {
    visibleNotifications.forEach(notif => {
      selectedNotifications.delete(notif.id);
    });
  }
  renderNotifications();
  updateActionButtons();
}

// Update select all checkbox
function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all');
  if (!selectAllCheckbox) return;

  const visibleNotifications = getVisibleNotifications();
  const checkedCount = visibleNotifications.filter(notif => 
    selectedNotifications.has(notif.id)
  ).length;

  selectAllCheckbox.checked = checkedCount > 0 && checkedCount === visibleNotifications.length;
  selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < visibleNotifications.length;
}

// Update notification count
function updateNotificationCount() {
  const count = getVisibleNotifications().length;
  const countElement = document.getElementById('notification-count');
  if (countElement) {
    countElement.textContent = count;
  }
}

// Update notification counts in sidebar
function updateNotificationCounts() {
  const allCount = notificationsData.filter(notif => 
    !archivedNotifications.has(notif.id) && !trashNotifications.has(notif.id) && !permanentlyDeletedNotifications.has(notif.id)
  ).length;
  
  const unreadCount = notificationsData.filter(notif => 
    !notif.read && !archivedNotifications.has(notif.id) && !trashNotifications.has(notif.id) && !permanentlyDeletedNotifications.has(notif.id)
  ).length;
  
  const expiredCount = notificationsData.filter(notif => 
    notif.type === 'expired' && !archivedNotifications.has(notif.id) && !trashNotifications.has(notif.id) && !permanentlyDeletedNotifications.has(notif.id)
  ).length;
  
  const expiringCount = notificationsData.filter(notif => 
    notif.type === 'expiring-soon' && !archivedNotifications.has(notif.id) && !trashNotifications.has(notif.id) && !permanentlyDeletedNotifications.has(notif.id)
  ).length;
  
  const mealPlanCount = notificationsData.filter(notif => 
    notif.type === 'meal-plans' && !archivedNotifications.has(notif.id) && !trashNotifications.has(notif.id) && !permanentlyDeletedNotifications.has(notif.id)
  ).length;
  
  const donationCount = notificationsData.filter(notif => 
    notif.type === 'donations' && !archivedNotifications.has(notif.id) && !trashNotifications.has(notif.id) && !permanentlyDeletedNotifications.has(notif.id)
  ).length;

  // Update badges
  updateBadge('all', allCount);
  updateBadge('unread', unreadCount);
  updateBadge('expired', expiredCount);
  updateBadge('expiring-soon', expiringCount);
  updateBadge('meal-plans', mealPlanCount);
  updateBadge('donations', donationCount);
}

// Update badge for a filter
function updateBadge(filter, count) {
  const navItem = document.querySelector(`[data-filter="${filter}"]`);
  if (navItem) {
    const badge = navItem.querySelector('.badge');
    if (badge) {
      badge.textContent = count;
      if (filter === 'all' && count > 0) {
        badge.className = 'badge badge-green';
      } else if (count > 0) {
        badge.className = 'badge badge-grey';
      }
    }
  }
}

// Update action buttons visibility
function updateActionButtons() {
  const actionButtons = document.getElementById('action-buttons');
  const normalButtons = document.getElementById('normal-action-buttons');
  const archiveButtons = document.getElementById('archive-action-buttons');
  const trashButtons = document.getElementById('trash-action-buttons');
  
  if (!actionButtons) return;

  // Hide all button groups first
  if (normalButtons) normalButtons.style.display = 'none';
  if (archiveButtons) archiveButtons.style.display = 'none';
  if (trashButtons) trashButtons.style.display = 'none';

  if (selectedNotifications.size > 0) {
    actionButtons.style.display = 'flex';
    
    // Show appropriate button group based on current filter
    if (currentFilter === 'archived') {
      if (archiveButtons) archiveButtons.style.display = 'flex';
    } else if (currentFilter === 'trash') {
      if (trashButtons) trashButtons.style.display = 'flex';
    } else {
      if (normalButtons) normalButtons.style.display = 'flex';
    }
  } else {
    actionButtons.style.display = 'none';
  }
}

// Archive selected notifications
function archiveSelectedNotifications() {
  if (selectedNotifications.size === 0) return;
  
  selectedNotifications.forEach(id => {
    archivedNotifications.add(id);
    trashNotifications.delete(id);
  });
  selectedNotifications.clear();
  updateSelectAllCheckbox();
  updateActionButtons();
  updateNotificationCounts();
  renderNotifications();
  showPlaceholder();
}

// Move selected notifications to trash
function moveSelectedToTrash() {
  if (selectedNotifications.size === 0) return;
  
  const now = Date.now();
  selectedNotifications.forEach(id => {
    trashNotifications.set(id, now); // Store timestamp
    archivedNotifications.delete(id);
  });
  selectedNotifications.clear();
  updateSelectAllCheckbox();
  updateActionButtons();
  updateNotificationCounts();
  renderNotifications();
  showPlaceholder();
}

// Unarchive selected notifications (from Archive view)
function unarchiveSelectedNotifications() {
  if (selectedNotifications.size === 0) return;
  
  selectedNotifications.forEach(id => {
    archivedNotifications.delete(id);
  });
  selectedNotifications.clear();
  updateSelectAllCheckbox();
  updateActionButtons();
  updateNotificationCounts();
  renderNotifications();
  showPlaceholder();
}

// Move archived notifications to trash (from Archive view)
function moveArchiveToTrash() {
  if (selectedNotifications.size === 0) return;
  
  const now = Date.now();
  selectedNotifications.forEach(id => {
    archivedNotifications.delete(id);
    trashNotifications.set(id, now); // Store timestamp
  });
  selectedNotifications.clear();
  updateSelectAllCheckbox();
  updateActionButtons();
  updateNotificationCounts();
  renderNotifications();
  showPlaceholder();
}

// Restore selected notifications from trash (from Trash view)
function restoreSelectedNotifications() {
  if (selectedNotifications.size === 0) return;
  
  selectedNotifications.forEach(id => {
    trashNotifications.delete(id);
  });
  selectedNotifications.clear();
  updateSelectAllCheckbox();
  updateActionButtons();
  updateNotificationCounts();
  renderNotifications();
  showPlaceholder();
}

// Permanently delete selected notifications from trash (from Trash view)
function permanentlyDeleteSelectedNotifications() {
  if (selectedNotifications.size === 0) return;
  
  // Confirm with user
  const count = selectedNotifications.size;
  const message = count === 1 
    ? 'Are you sure you want to permanently delete this notification? This action cannot be undone.'
    : `Are you sure you want to permanently delete ${count} notifications? This action cannot be undone.`;
  
  if (!confirm(message)) {
    return; // User cancelled
  }
  
  // Permanently delete
  selectedNotifications.forEach(id => {
    trashNotifications.delete(id);
    permanentlyDeletedNotifications.add(id);
  });
  selectedNotifications.clear();
  updateSelectAllCheckbox();
  updateActionButtons();
  updateNotificationCounts();
  renderNotifications();
  showPlaceholder();
}

// Export functions for use in HTML
window.archiveSelectedNotifications = archiveSelectedNotifications;
window.moveSelectedToTrash = moveSelectedToTrash;
window.unarchiveSelectedNotifications = unarchiveSelectedNotifications;
window.moveArchiveToTrash = moveArchiveToTrash;
window.restoreSelectedNotifications = restoreSelectedNotifications;
window.permanentlyDeleteSelectedNotifications = permanentlyDeleteSelectedNotifications;


// Firebase Messaging Service Worker
// This runs in the background to receive push notifications even when the page is closed

importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC9R2FKE9gwinvVocs92EtPjoFHG2TfDWM",
  authDomain: "student-feedback-form-489916.firebaseapp.com",
  projectId: "student-feedback-form-489916",
  storageBucket: "student-feedback-form-489916.firebasestorage.app",
  messagingSenderId: "592918420084",
  appId: "1:592918420084:web:2a263dafcd489826c2cf21"
});

const messaging = firebase.messaging();

// ── Notification icon/badge SVG helpers ───────────────────────────────────
const ICONS = {
  assignment: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎓</text></svg>',
  urgent:     'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚠️</text></svg>',
  general:    'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📢</text></svg>',
  badge:      'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔔</text></svg>'
};

// Handle background messages (when page is not in focus)
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message received:', payload);

  const data  = payload.data  || {};
  const notif = payload.notification || {};
  const type  = data.type || 'general';

  const title = notif.title || data.title || 'Student Feedback';
  const body  = notif.body  || data.body  || 'You have a new notification';

  // Notification actions (Chrome on Android supports up to 2)
  const actions = [];
  if (type === 'assignment') {
    actions.push({ action: 'view-teachers',  title: '🎓 View Teachers' });
    actions.push({ action: 'give-feedback',  title: '📝 Give Feedback' });
  } else if (type === 'urgent') {
    actions.push({ action: 'open-app', title: '👁 Open App' });
    actions.push({ action: 'dismiss',  title: '✕ Dismiss' });
  } else {
    actions.push({ action: 'open-app', title: '📖 Open' });
    actions.push({ action: 'dismiss',  title: '✕ Dismiss' });
  }

  const options = {
    body,
    icon:               ICONS[type] || ICONS.general,
    badge:              ICONS.badge,
    data:               { ...data, type, url: data.url || '/feedback/student-dashboard.html#notifications' },
    requireInteraction: type === 'assignment' || type === 'urgent',
    tag:                data.tag || ('sf-notif-' + type),
    renotify:           true,
    actions
  };

  return self.registration.showNotification(title, options);
});

// ── Handle notification click / action buttons ────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const action = event.action;
  const data   = event.notification.data || {};
  const type   = data.type || 'general';

  // 'dismiss' action → just close (already done above)
  if (action === 'dismiss') return;

  let targetUrl = '/feedback/student-dashboard.html#notifications';
  if (action === 'view-teachers' || type === 'assignment') {
    targetUrl = '/feedback/student-dashboard.html#teachers';
  } else if (action === 'give-feedback') {
    targetUrl = '/feedback/feedback-form.html';
  } else if (data.url) {
    targetUrl = data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // If the app is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes('/feedback/') && 'focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window
      return clients.openWindow(targetUrl);
    })
  );
});

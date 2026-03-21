// Firebase Messaging Service Worker — with FORCE_LOGOUT support
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
const ICONS = {
  assignment: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>\uD83C\uDF93</text></svg>',
  urgent: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>\u26A0\uFE0F</text></svg>',
  general: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>\uD83D\uDCE2</text></svg>',
  badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>\uD83D\uDD14</text></svg>'
};

messaging.onBackgroundMessage(function(payload) {
  const data = payload.data || {};
  const notif = payload.notification || {};
  const type = data.type || 'general';

  // FORCE_LOGOUT: Cross-device session invalidation
  if (data.action === 'FORCE_LOGOUT') {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      clients.forEach(function(client) {
        client.postMessage({ action: 'FORCE_LOGOUT', reason: data.reason || 'new_device_login' });
      });
    });
    return self.registration.showNotification('Session Expired', {
      body: 'Logged out: another device signed in.',
      icon: ICONS.urgent, badge: ICONS.badge,
      tag: 'sf-force-logout',
      data: { type: 'force_logout', url: '/feedback/index.html' }
    });
  }

  // Regular notifications
  const title = notif.title || data.title || 'Student Feedback';
  const body = notif.body || data.body || 'You have a new notification';
  const actions = [];
  if (type === 'assignment') { actions.push({ action: 'view-teachers', title: 'View Teachers' }); actions.push({ action: 'give-feedback', title: 'Give Feedback' }); }
  else { actions.push({ action: 'open-app', title: 'Open' }); actions.push({ action: 'dismiss', title: 'Dismiss' }); }
  return self.registration.showNotification(title, {
    body, icon: ICONS[type] || ICONS.general, badge: ICONS.badge,
    data: { ...data, type, url: data.url || '/feedback/student-dashboard.html#notifications' },
    requireInteraction: type === 'assignment' || type === 'urgent',
    tag: data.tag || ('sf-notif-' + type), renotify: true, actions
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const data = event.notification.data || {};
  let url = '/feedback/student-dashboard.html#notifications';
  if (data.type === 'force_logout') url = '/feedback/index.html';
  else if (event.action === 'view-teachers') url = '/feedback/student-dashboard.html#teachers';
  else if (event.action === 'give-feedback') url = '/feedback/feedback-form.html';
  else if (data.url) url = data.url;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(wc) {
    for (const c of wc) { if (c.url.includes('/feedback/') && 'focus' in c) { c.focus(); if ('navigate' in c) return c.navigate(url); return; } }
    return clients.openWindow(url);
  }));
});

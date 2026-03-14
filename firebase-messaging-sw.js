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

// Handle background messages (when page is not in focus)
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message received:', payload);
  const title = payload.notification?.title || 'Student Feedback';
  const options = {
    body: payload.notification?.body || 'You have a new notification',
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📝</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔔</text></svg>',
    data: payload.data || {},
    requireInteraction: true
  };
  return self.registration.showNotification(title, options);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/feedback/student-dashboard.html#notifications')
  );
});

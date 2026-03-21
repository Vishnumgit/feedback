const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Send FCM FORCE_LOGOUT push when session token changes
exports.onSessionChange = functions.firestore
  .document('sessions/{userId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    if (!before || !after) return null;
    if (before.sessionToken === after.sessionToken) return null;
    if (!before.fcmToken || before.fcmToken === after.fcmToken) return null;
    
    try {
      await admin.messaging().send({
        token: before.fcmToken,
        data: { action: 'FORCE_LOGOUT', reason: 'new_device_login', type: 'force_logout' },
        android: { priority: 'high' },
        webpush: { headers: { Urgency: 'high' } }
      });
      console.log('[FCM] FORCE_LOGOUT sent for user', context.params.userId);
    } catch (e) { console.warn('[FCM] Send failed:', e.message); }
    return null;
  });

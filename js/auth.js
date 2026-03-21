// ============================================================
// auth.js — Authentication & Session Management (REST API version)
// ============================================================

var SESSION_KEY = 'sfft_session';

function generateSessionToken() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function login(email, password) {
  var user = getUserByEmail(email);
  if (!user) throw new Error('No account found with this email.');
  if (!user.active) throw new Error('Your account has been deactivated. Contact admin.');
  if (user.password !== password) throw new Error('Incorrect password.');
  var sessionToken = generateSessionToken();
  var session = { userId: user.id, role: user.role, email: user.email, name: user.name, department: user.department || '', section: user.section || '', loginAt: Date.now(), sessionToken: sessionToken };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  _writeSessionToFirestore(user.id, sessionToken);
  return session;
}

function decodeGoogleJWT(credential) {
  try {
    var parts = credential.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch(e) { throw new Error('Failed to decode Google credential.'); }
}

function googleLogin(credential, expectedRole) {
  var payload = decodeGoogleJWT(credential);
  var email = (payload.email || '').toLowerCase();
  var user = getUserByEmail(email);
  if (!user) throw new Error('No account found for ' + email + '.\nAsk your admin to register this Google email.');
  if (!user.active) throw new Error('Your account has been deactivated. Contact admin.');
  if (expectedRole && user.role !== expectedRole) throw new Error('This portal is for ' + expectedRole + 's only.\nYour account role is: ' + user.role + '.');
  var sessionToken = generateSessionToken();
  var session = { userId: user.id, role: user.role, email: user.email, name: user.name, department: user.department || '', section: user.section || '', loginAt: Date.now(), viaGoogle: true, sessionToken: sessionToken };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  _writeSessionToFirestore(user.id, sessionToken);
  return session;
}

function _writeSessionToFirestore(userId, sessionToken) {
  var sessionData = { sessionToken: sessionToken, loginAt: Date.now() };
  _getFCMToken().then(function(fcmToken) {
    if (fcmToken) sessionData.fcmToken = fcmToken;
    return FirestoreREST.setDoc('sessions', userId, sessionData);
  }).then(function() { console.log('[Auth] Session written via REST'); })
    .catch(function(e) { console.warn('[Auth] Session write failed:', e.message); });
}

function _getFCMToken() {
  return new Promise(function(resolve) {
    try {
      if (typeof firebase === 'undefined' || !firebase.messaging) { resolve(null); return; }
      var messaging = firebase.messaging();
      Notification.requestPermission().then(function(permission) {
        if (permission !== 'granted') { resolve(null); return; }
        return messaging.getToken();
      }).then(function(token) { resolve(token || null); }).catch(function() { resolve(null); });
    } catch(e) { resolve(null); }
  });
}

function startSessionListener() {
  var session = getSession();
  if (!session || !session.sessionToken || !session.userId) return;
  _writeSessionToFirestore(session.userId, session.sessionToken);
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && event.data.action === 'FORCE_LOGOUT') {
        sessionStorage.removeItem(SESSION_KEY);
        alert('You have been logged out because your account was signed in on another device.');
        window.location.href = 'index.html';
      }
    });
  }
}

function validateSession() {
  var session = getSession();
  if (!session || !session.userId || !session.sessionToken) return Promise.resolve(false);
  return FirestoreREST.getDoc('sessions', session.userId).then(function(doc) {
    if (!doc) return true;
    if (doc.sessionToken && doc.sessionToken !== session.sessionToken) {
      sessionStorage.removeItem(SESSION_KEY);
      alert('You have been logged out because your account was signed in on another device.');
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }).catch(function() { return true; });
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
  window.location.href = 'index.html';
}
function getSession() { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
function requireAuth(expectedRole) {
  var s = getSession();
  if (!s) { window.location.href = 'index.html'; return null; }
  if (expectedRole && s.role !== expectedRole) { window.location.href = 'index.html'; return null; }
  return s;
}

function changePassword(userId, currentPassword, newPassword) {
  var user = getUserById(userId);
  if (!user) throw new Error('User not found.');
  if (user.password !== currentPassword) throw new Error('Current password is incorrect.');
  if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters.');
  user.password = newPassword; saveUser(user);
  if (typeof fsSetDoc === 'function') fsSetDoc('users', user.id, user);
  return true;
}
function adminResetPassword(userId, newPassword) {
  var user = getUserById(userId);
  if (!user) throw new Error('User not found.');
  if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters.');
  user.password = newPassword; saveUser(user);
  if (typeof fsSetDoc === 'function') fsSetDoc('users', user.id, user);
  return true;
}
function validateCollegeEmail(email) {
  var settings = getSettings();
  var domain = settings.collegeDomain || 'college.edu';
  return email.toLowerCase().endsWith('@' + domain.toLowerCase());
}

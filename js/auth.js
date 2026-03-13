// ============================================================
// auth.js — Authentication & Session Management
// ============================================================

const SESSION_KEY = 'sfft_session';

function generateSessionToken() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function login(email, password) {
  const user = getUserByEmail(email);
  if (!user) throw new Error('No account found with this email.');
  if (!user.active) throw new Error('Your account has been deactivated. Contact admin.');
  if (user.password !== password) throw new Error('Incorrect password.');
  const sessionToken = generateSessionToken();
  const session = { userId: user.id, role: user.role, email: user.email, name: user.name, loginAt: Date.now(), sessionToken: sessionToken };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Note: Firestore write happens in startSessionListener() on the dashboard page
  // because the login page redirects away too fast for async writes to complete
  return session;
}

// ---- Google Sign-In ----
function decodeGoogleJWT(credential) {
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch(e) {
    throw new Error('Failed to decode Google credential.');
  }
}

function googleLogin(credential, expectedRole) {
  const payload  = decodeGoogleJWT(credential);
  const email    = (payload.email || '').toLowerCase();
  const name     = payload.name  || email;

  const user = getUserByEmail(email);
  if (!user) throw new Error('No account found for ' + email + '.\nAsk your admin to register this Google email.');
  if (!user.active) throw new Error('Your account has been deactivated. Contact admin.');
  if (expectedRole && user.role !== expectedRole) {
    throw new Error('This portal is for ' + expectedRole + 's only.\nYour account role is: ' + user.role + '.');
  }

  const sessionToken = generateSessionToken();
  const session = { userId: user.id, role: user.role, email: user.email, name: user.name, loginAt: Date.now(), viaGoogle: true, sessionToken: sessionToken };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

// ---- Session Listener (single-session enforcement) ----
var _sessionUnsub = null;

function startSessionListener() {
  var session = getSession();
  if (!session || !session.sessionToken || !session.userId) return;
  if (typeof db === 'undefined') return;

  var myToken = session.sessionToken;
  var myUserId = session.userId;

  // Step 1: Write our session token to Firestore (from the dashboard page, which stays open)
  db.collection('users').doc(myUserId).set({ sessionToken: myToken }, { merge: true })
    .then(function() {
      console.log('[Auth] Session token written to Firestore:', myToken);
    })
    .catch(function(e) {
      console.warn('[Auth] Failed to write session token:', e.message);
    });

  // Step 2: Listen for changes — if another device overwrites the token, force logout
  _sessionUnsub = db.collection('users').doc(myUserId).onSnapshot(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    var localSession = getSession();
    if (!localSession || !localSession.sessionToken) return;

    // Only check once Firestore has a token (skip the initial undefined)
    if (data.sessionToken && data.sessionToken !== localSession.sessionToken) {
      console.log('[Auth] Another device logged in! Forcing logout.');
      if (_sessionUnsub) { _sessionUnsub(); _sessionUnsub = null; }
      sessionStorage.removeItem(SESSION_KEY);
      alert('You have been logged out because your account was signed in on another device.');
      window.location.href = 'index.html';
    }
  }, function(err) {
    console.warn('[Auth] Session listener error:', err.message);
  });
}

function logout() {
  if (_sessionUnsub) { _sessionUnsub(); _sessionUnsub = null; }
  sessionStorage.removeItem(SESSION_KEY);
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  window.location.href = 'index.html';
}

function getSession() {
  return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
}

function requireAuth(expectedRole) {
  var session = getSession();
  if (!session) { window.location.href = 'index.html'; return null; }
  if (expectedRole && session.role !== expectedRole) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

function validateCollegeEmail(email) {
  var settings = getSettings();
  var domain = settings.collegeDomain || 'college.edu';
  return email.toLowerCase().endsWith('@' + domain.toLowerCase());
}

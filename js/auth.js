// ============================================================
// auth.js — Authentication & Session Management
// ============================================================

const SESSION_KEY = 'sfft_session';

// Use cryptographically secure random token
function generateSessionToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// ---- Login Rate Limiting ------------------------------------
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_ATTEMPTS_KEY = 'sfft_login_attempts';

function getLoginAttempts(email) {
  try {
    const data = JSON.parse(sessionStorage.getItem(LOGIN_ATTEMPTS_KEY) || '{}');
    return data[email.toLowerCase()] || { count: 0, lastAttempt: 0 };
  } catch(e) { return { count: 0, lastAttempt: 0 }; }
}

function recordLoginAttempt(email, success) {
  try {
    const data = JSON.parse(sessionStorage.getItem(LOGIN_ATTEMPTS_KEY) || '{}');
    const key = email.toLowerCase();
    if (success) {
      delete data[key];
    } else {
      const now = Date.now();
      const prev = data[key] || { count: 0, lastAttempt: 0 };
      if (now - prev.lastAttempt > LOCKOUT_DURATION_MS) {
        data[key] = { count: 1, lastAttempt: now };
      } else {
        data[key] = { count: prev.count + 1, lastAttempt: now };
      }
    }
    sessionStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(data));
  } catch(e) {}
}

function checkLoginRateLimit(email) {
  const attempts = getLoginAttempts(email);
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const elapsed = Date.now() - attempts.lastAttempt;
    const remaining = Math.ceil((LOCKOUT_DURATION_MS - elapsed) / 60000);
    if (remaining > 0) {
      throw new Error('Too many failed login attempts. Please try again in ' + remaining + ' minute(s).');
    } else {
      recordLoginAttempt(email, true); // Reset expired lockout
    }
  }
}

async function login(email, password) {
  checkLoginRateLimit(email);
  const user = getUserByEmail(email);
  if (!user) {
    recordLoginAttempt(email, false);
    throw new Error('No account found with this email.');
  }
  if (!user.active) throw new Error('Your account has been deactivated. Contact admin.');

  let passwordMatch = false;
  if (user.passwordHash) {
    const inputHash = await hashPassword(password, email);
    passwordMatch = (user.passwordHash === inputHash);
    if (!passwordMatch && user.password) {
      // Legacy plaintext fallback
      passwordMatch = (user.password === password);
      if (passwordMatch) {
        // Migrate to hashed password
        user.passwordHash = inputHash.length > 0 ? inputHash : await hashPassword(password, email);
        delete user.password;
        saveUser(user);
      }
    }
  } else if (user.password) {
    // Legacy plaintext — compare and migrate
    passwordMatch = (user.password === password);
    if (passwordMatch) {
      const hash = await hashPassword(password, email);
      user.passwordHash = hash;
      delete user.password;
      saveUser(user);
    }
  }

  if (!passwordMatch) {
    recordLoginAttempt(email, false);
    throw new Error('Incorrect password.');
  }
  recordLoginAttempt(email, true);

  const sessionToken = generateSessionToken();
  const session = { userId: user.id, role: user.role, email: user.email, name: user.name, department: user.department || '', section: user.section || '', loginAt: Date.now(), sessionToken: sessionToken };
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
  const session = { userId: user.id, role: user.role, email: user.email, name: user.name, department: user.department || '', section: user.section || '', loginAt: Date.now(), viaGoogle: true, sessionToken: sessionToken };
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

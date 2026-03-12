// ============================================================
// auth.js — Authentication & Session Management
// ============================================================

const SESSION_KEY = 'sfft_session';

function login(email, password) {
  const user = getUserByEmail(email);
  if (!user) throw new Error('No account found with this email.');
  if (!user.active) throw new Error('Your account has been deactivated. Contact admin.');
  if (user.password !== password) throw new Error('Incorrect password.');
  const session = { userId: user.id, role: user.role, email: user.email, name: user.name, loginAt: Date.now() };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

// ---- Google Sign-In ----
// Decodes a Google Identity Services JWT (no library needed — payload is base64)
function decodeGoogleJWT(credential) {
  try {
    const parts = credential.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload; // { email, name, picture, sub, ... }
  } catch(e) {
    throw new Error('Failed to decode Google credential.');
  }
}

function googleLogin(credential, expectedRole) {
  const payload  = decodeGoogleJWT(credential);
  const email    = (payload.email || '').toLowerCase();
  const name     = payload.name  || email;

  // Special case: admin can log in with any Google account if email matches admin record
  const user = getUserByEmail(email);
  if (!user) throw new Error(`No account found for ${email}.\nAsk your admin to register this Google email.`);
  if (!user.active) throw new Error('Your account has been deactivated. Contact admin.');
  if (expectedRole && user.role !== expectedRole) {
    throw new Error(`This portal is for ${expectedRole}s only.\nYour account role is: ${user.role}.`);
  }

  const session = { userId: user.id, role: user.role, email: user.email, name: user.name, loginAt: Date.now(), viaGoogle: true };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  // Also sign out from Google silently
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  window.location.href = 'index.html';
}

function getSession() {
  return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
}

function requireAuth(expectedRole) {
  const session = getSession();
  if (!session) { window.location.href = 'index.html'; return null; }
  if (expectedRole && session.role !== expectedRole) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}

function validateCollegeEmail(email) {
  const settings = getSettings();
  const domain = settings.collegeDomain || 'college.edu';
  return email.toLowerCase().endsWith('@' + domain.toLowerCase());
}

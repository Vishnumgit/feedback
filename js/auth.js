// ============================================================
// auth.js — Firebase Authentication & Session Management
// ============================================================
// MIGRATED: Uses firebase.auth() for Firestore security rules.
// Auto-migration: Existing localStorage users get Firebase Auth
// accounts on their first login. NO DATA LOSS.
// ============================================================

const SESSION_KEY = 'sfft_session';

function generateSessionToken() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ---- Firestore user lookup fallback ----
// Used when a user exists in Firestore but hasn't been synced to localStorage yet.
async function fetchUserFromFirestore(email) {
  try {
    if (typeof db === 'undefined') return null;
    var normalizedEmail = email.toLowerCase();
    var snap = await db.collection('users').where('email', '==', normalizedEmail).get();
    if (snap.empty) {
      // Some documents may have been stored with original casing
      snap = await db.collection('users').where('email', '==', email).get();
    }
    if (snap.empty) return null;
    var data = snap.docs[0].data();
    // Ensure the local id field is populated (Firestore may store it as customId)
    if (!data.id && data.customId) data.id = data.customId;
    if (!data.email) data.email = normalizedEmail;
    // Merge into localStorage so subsequent calls use the fast path
    var users = JSON.parse(localStorage.getItem('sfft_users') || '[]');
    var idx = users.findIndex(function(u) {
      return (u.email || '').toLowerCase() === normalizedEmail;
    });
    if (idx > -1) {
      users[idx] = Object.assign({}, users[idx], data);
    } else {
      users.push(data);
    }
    localStorage.setItem('sfft_users', JSON.stringify(users));
    return getUserByEmail(email);
  } catch (e) {
    console.warn('[Auth] Firestore user lookup failed:', e.message);
    return null;
  }
}

// ---- Firebase Auth Login ----
async function login(email, password) {
  var localUser = getUserByEmail(email);
  if (!localUser) {
    // User may not have been synced to localStorage yet — try Firestore directly
    console.log('[Auth] User not in localStorage, trying Firestore for:', email);
    localUser = await fetchUserFromFirestore(email);
  }
  if (!localUser) throw new Error('No account found with this email.');
  if (!localUser.active) throw new Error('Your account has been deactivated. Contact admin.');

  var userCredential;
  try {
    userCredential = await auth.signInWithEmailAndPassword(email, password);
  } catch(e) {
    if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
      // Auto-migrate: user in localStorage but not Firebase Auth
      var inputHash = await hashPassword(password);
      // Support both legacy plaintext and new hashed passwords
      if (localUser.passwordHash) {
        if (localUser.passwordHash !== inputHash) throw new Error('Incorrect password.');
      } else if (localUser.password !== password) {
        throw new Error('Incorrect password.');
      }
      console.log('[Auth] Auto-migrating user to Firebase Auth:', email);
      try {
        userCredential = await auth.createUserWithEmailAndPassword(email, password);
      } catch(createErr) {
        if (createErr.code === 'auth/email-already-in-use') {
          // Password was changed outside Firebase Auth (e.g. admin reset)
          // Fall back to anonymous auth — app still works
          console.log('[Auth] Password mismatch with Firebase Auth, using anonymous fallback');
          try { await auth.signInAnonymously(); } catch(ae) {}
          userCredential = { user: auth.currentUser || { uid: 'anon_' + localUser.id } };
        } else {
          throw createErr;
        }
      }
    } else if (e.code === 'auth/wrong-password') {
      throw new Error('Incorrect password.');
    } else {
      throw new Error('Login failed: ' + e.message);
    }
  }

  var firebaseUid = userCredential.user.uid;

  // Write Firestore user doc — fire-and-forget (non-blocking for faster login)
  db.collection('users').doc(firebaseUid).set({
    customId: localUser.id,
    email: localUser.email,
    name: localUser.name,
    role: localUser.role,
    department: localUser.department || '',
    section: localUser.section || '',
    subjectId: localUser.subjectId || null,
    active: localUser.active,
    lastLogin: Date.now()
  }, { merge: true }).catch(function(fsErr) {
    console.warn('[Auth] Firestore user doc write failed:', fsErr.message);
  });

  // Save Firebase UID mapping in localStorage
  if (!localUser.firebaseUid || localUser.firebaseUid !== firebaseUid) {
    localUser.firebaseUid = firebaseUid;
    saveUser(localUser);
  }

  var session = {
    userId: localUser.id,
    firebaseUid: firebaseUid,
    role: localUser.role,
    email: localUser.email,
    name: localUser.name,
    department: localUser.department || '',
    section: localUser.section || '',
    loginAt: Date.now(),
    sessionToken: generateSessionToken()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

// ---- Google Sign-In ----
function decodeGoogleJWT(credential) {
  try {
    var parts = credential.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch(e) {
    throw new Error('Failed to decode Google credential.');
  }
}

async function googleLogin(credential, expectedRole) {
  var payload = decodeGoogleJWT(credential);
  var email = (payload.email || '').toLowerCase();

  var localUser = getUserByEmail(email);
  if (!localUser) {
    // User may not have been synced to localStorage yet — try Firestore directly
    console.log('[Auth] Google user not in localStorage, trying Firestore for:', email);
    localUser = await fetchUserFromFirestore(email);
  }
  if (!localUser) throw new Error('No account found for ' + email + '.\nAsk your admin to register this Google email.');
  if (!localUser.active) throw new Error('Your account has been deactivated. Contact admin.');
  if (expectedRole && localUser.role !== expectedRole) {
    throw new Error('This portal is for ' + expectedRole + 's only.\nYour account role is: ' + localUser.role + '.');
  }

  var firebaseUid = null;
  try {
    var googleCred = firebase.auth.GoogleAuthProvider.credential(credential);
    var userCredential = await auth.signInWithCredential(googleCred);
    firebaseUid = userCredential.user.uid;

    await db.collection('users').doc(firebaseUid).set({
      customId: localUser.id, email: localUser.email, name: localUser.name,
      role: localUser.role, department: localUser.department || '',
      section: localUser.section || '', active: localUser.active, lastLogin: Date.now()
    }, { merge: true });

    localUser.firebaseUid = firebaseUid;
    saveUser(localUser);
  } catch(e) {
    console.warn('[Auth] Google Firebase auth fallback:', e.message);
    try { await auth.signInAnonymously(); } catch(ae) {}
  }

  var session = {
    userId: localUser.id, firebaseUid: firebaseUid, role: localUser.role,
    email: localUser.email, name: localUser.name, department: localUser.department || '',
    section: localUser.section || '', loginAt: Date.now(), viaGoogle: true,
    sessionToken: generateSessionToken()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

// ---- Google Sign-In via Google Identity Services (GIS) ----
// Uses Google Identity Services (GIS) instead of Firebase popup for Google OAuth2.
async function googleLoginWithPopup(expectedRole) {
  return new Promise(function(resolve, reject) {
    google.accounts.id.initialize({
      client_id: '592918420084-qgj2566dvssfqboiv7bbassro1tui3eb.apps.googleusercontent.com',
      callback: async function(response) {
        try {
          var session = await googleLogin(response.credential, expectedRole);
          resolve(session);
        } catch(e) {
          reject(e);
        }
      },
      cancel_on_tap_outside: false
    });
    google.accounts.id.prompt(function(notification) {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: render Sign In With Google button
        google.accounts.id.renderButton(
          document.getElementById('googleSignInWrap'),
          { theme: 'outline', size: 'large', width: 320 }
        );
      }
    });
  });
}

// ---- Session Listener ----
var _sessionUnsub = null;

function startSessionListener() {
  var session = getSession();
  if (!session || !session.sessionToken) return;
  if (session.isDemo) return; // Skip Firestore session tracking in demo mode
  if (typeof db === 'undefined') return;

  // Use session.userId for session token tracking — it's consistent across devices
  // (firebaseUid can differ per device due to anonymous auth fallback)
  var docId = session.userId;
  var myToken = session.sessionToken;

  db.collection('users').doc(docId).set({ sessionToken: myToken }, { merge: true })
    .then(function() { console.log('[Auth] Session token written'); })
    .catch(function(e) { console.warn('[Auth] Session token write failed:', e.message); });

  _sessionUnsub = db.collection('users').doc(docId).onSnapshot(function(doc) {
    if (!doc.exists) return;
    var data = doc.data();
    var local = getSession();
    if (!local || !local.sessionToken) return;
    if (data.sessionToken && data.sessionToken !== local.sessionToken) {
      if (_sessionUnsub) { _sessionUnsub(); _sessionUnsub = null; }
      sessionStorage.removeItem(SESSION_KEY);
      alert('You have been logged out because your account was signed in on another device.');
      window.location.href = 'index.html';
    }
  }, function(err) { console.warn('[Auth] Listener error:', err.message); });
}

async function logout() {
  if (_sessionUnsub) { _sessionUnsub(); _sessionUnsub = null; }
  sessionStorage.removeItem(SESSION_KEY);
  try { await auth.signOut(); } catch(e) {}
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
    window.location.href = 'index.html'; return null;
  }
  return session;
}

// ---- Change Password ----
async function changePassword(userId, currentPassword, newPassword) {
  var user = getUserById(userId);
  if (!user) throw new Error('User not found.');
  var currentHash = await hashPassword(currentPassword);
  // Support both legacy plaintext and new hashed passwords
  if (user.passwordHash) {
    if (user.passwordHash !== currentHash) throw new Error('Current password is incorrect.');
  } else if (user.password !== currentPassword) {
    throw new Error('Current password is incorrect.');
  }
  if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters.');

  var fbUser = auth.currentUser;
  if (fbUser) {
    try {
      await fbUser.updatePassword(newPassword);
    } catch(e) {
      if (e.code === 'auth/requires-recent-login') {
        var cred = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        await fbUser.reauthenticateWithCredential(cred);
        await fbUser.updatePassword(newPassword);
      }
    }
  }

  user.passwordHash = await hashPassword(newPassword);
  delete user.password; // Remove legacy plaintext
  saveUser(user);
  if (typeof fsSetDoc === 'function') fsSetDoc('users', user.firebaseUid || user.id, user);
  return true;
}

async function adminResetPassword(userId, newPassword) {
  var user = getUserById(userId);
  if (!user) throw new Error('User not found.');
  if (!newPassword || newPassword.length < 6) throw new Error('New password must be at least 6 characters.');
  user.passwordHash = await hashPassword(newPassword);
  delete user.password; // Remove legacy plaintext
  saveUser(user);
  if (typeof fsSetDoc === 'function') fsSetDoc('users', user.firebaseUid || user.id, user);
  return true;
}

function validateCollegeEmail(email) {
  var settings = getSettings();
  var domain = settings.collegeDomain || 'college.edu';
  return email.toLowerCase().endsWith('@' + domain.toLowerCase());
}

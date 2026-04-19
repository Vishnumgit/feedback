// ============================================================
// auth.js — Firebase Authentication & Session Management
// ============================================================
// MIGRATED: Uses firebase.auth() for Firestore security rules.
// Auto-migration: Existing localStorage users get Firebase Auth
// accounts on their first login. NO DATA LOSS.
// ============================================================

const SESSION_KEY = 'sfft_session';
const GOOGLE_EMAIL_MAP_KEY = 'sfft_google_email_map';

// Cache: maps Google email → local user ID for instant repeat Google logins
function getGoogleEmailMap() {
  try { return JSON.parse(localStorage.getItem(GOOGLE_EMAIL_MAP_KEY) || '{}'); } catch(e) { return {}; }
}
function setGoogleEmailMap(googleEmail, userId) {
  var map = getGoogleEmailMap();
  map[googleEmail.toLowerCase()] = userId;
  localStorage.setItem(GOOGLE_EMAIL_MAP_KEY, JSON.stringify(map));
}
function getUserByGoogleEmail(googleEmail) {
  var map = getGoogleEmailMap();
  var userId = map[googleEmail.toLowerCase()];
  if (userId) return getUserById(userId);
  return null;
}

function generateSessionToken() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ---- Firestore user lookup fallback ----
// Used when a user exists in Firestore but hasn't been synced to localStorage yet.
async function fetchUserFromFirestore(email, timeoutMs) {
  try {
    if (typeof db === 'undefined') return null;
    var normalizedEmail = email.toLowerCase();
    
    // Race against timeout for faster UX
    var queryPromise = db.collection('users').where('email', '==', normalizedEmail).get();
    var snap;
    if (timeoutMs) {
      var timeoutPromise = new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('Firestore timeout')); }, timeoutMs);
      });
      try {
        snap = await Promise.race([queryPromise, timeoutPromise]);
      } catch(te) {
        console.warn('[Auth] Firestore lookup timed out after ' + timeoutMs + 'ms');
        return null;
      }
    } else {
      snap = await queryPromise;
    }
    if (snap.empty) {
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

// ---- Firebase Auth Login (Optimized — local-first, Firebase in background) ----
async function login(email, password) {
  var localUser = getUserByEmail(email);
  if (!localUser) {
    // User may not have been synced to localStorage yet — try Firestore directly
    console.log('[Auth] User not in localStorage, trying Firestore for:', email);
    localUser = await fetchUserFromFirestore(email);
  }
  // ---- CROSS-DEVICE FIX v2: users collection is now publicly readable,
  // so Firestore lookup should succeed even without auth. ----
  if (!localUser) {
    throw new Error('No account found with this email. If this is a new device, please ask your admin to sync accounts.');
  }
  if (!localUser.active) throw new Error('Your account has been deactivated. Contact admin.');

  // ---- FAST PATH: Verify password locally first (no network call) ----
  var inputHash = await hashPassword(password);
  var localAuthPassed = false;

  if (localUser.passwordHash) {
    if (localUser.passwordHash !== inputHash) throw new Error('Incorrect password.');
    localAuthPassed = true;
  } else if (localUser.password) {
    if (localUser.password !== password) throw new Error('Incorrect password.');
    localAuthPassed = true;
  }

  // If local auth passed, create session IMMEDIATELY (no waiting for Firebase)
  if (localAuthPassed) {
    var session = {
      userId: localUser.id,
      firebaseUid: localUser.firebaseUid || null,
      role: localUser.role,
      email: localUser.email,
      name: localUser.name,
      department: localUser.department || '',
      section: localUser.section || '',
      loginAt: Date.now(),
      sessionToken: generateSessionToken()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

    // ---- BACKGROUND: Sync with Firebase Auth (non-blocking) ----
    syncFirebaseAuth(email, password, localUser, session).catch(function(e) {
      console.warn('[Auth] Background Firebase sync:', e.message);
    });

    return session;
  }

  // ---- FALLBACK: No local password hash — must use Firebase Auth directly ----
  var userCredential;
  try {
    userCredential = await auth.signInWithEmailAndPassword(email, password);
  } catch(e) {
    if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      throw new Error('Incorrect password.');
    }
    throw new Error('Login failed: ' + e.message);
  }

  var firebaseUid = userCredential.user.uid;
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

// ---- Background Firebase Auth Sync (runs after instant login) ----
async function syncFirebaseAuth(email, password, localUser, session) {
  try {
    var userCredential;
    try {
      userCredential = await auth.signInWithEmailAndPassword(email, password);
    } catch(e) {
      if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        console.log('[Auth] Background: auto-migrating to Firebase Auth');
        try {
          userCredential = await auth.createUserWithEmailAndPassword(email, password);
        } catch(createErr) {
          if (createErr.code === 'auth/email-already-in-use') {
            // DO NOT fall back to anonymous auth — it poisons the auth state
            // and breaks Firestore operations (cross-device logout, sync, etc.)
            console.warn('[Auth] Firebase Auth email-already-in-use — skipping Firebase Auth');
            userCredential = { user: { uid: localUser.firebaseUid || localUser.id } };
          } else {
            throw createErr;
          }
        }
      } else {
        throw e;
      }
    }

    var firebaseUid = userCredential.user.uid;

    // Update session with real Firebase UID if needed
    if (session.firebaseUid !== firebaseUid) {
      session.firebaseUid = firebaseUid;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }

    // Save Firebase UID mapping
    if (!localUser.firebaseUid || localUser.firebaseUid !== firebaseUid) {
      localUser.firebaseUid = firebaseUid;
      saveUser(localUser);
    }

    // Write Firestore user doc (include passwordHash for cross-device login)
    var firestoreData = {
      customId: localUser.id, email: localUser.email, name: localUser.name,
      role: localUser.role, department: localUser.department || '',
      section: localUser.section || '', subjectId: localUser.subjectId || null,
      active: localUser.active, lastLogin: Date.now()
    };
    // Store passwordHash in Firestore so new devices can verify locally
    if (localUser.passwordHash) firestoreData.passwordHash = localUser.passwordHash;
    db.collection('users').doc(firebaseUid).set(firestoreData, { merge: true }).catch(function(fsErr) {
      console.warn('[Auth] Firestore user doc write failed:', fsErr.message);
    });

    console.log('[Auth] Background Firebase sync complete');
    
    // Now that Firebase Auth is ready, start session listener for cross-device logout
    if (typeof startSessionListener === 'function') {
      startSessionListener();
    }
  } catch(e) {
    console.warn('[Auth] Background Firebase sync failed (login still works):', e.message);
  }
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

  // Fast path: check Google email cache first (instant for repeat logins)
  var localUser = getUserByGoogleEmail(email) || getUserByEmail(email);
  if (!localUser) {
    // User may not have been synced to localStorage yet — try Firestore directly
    console.log('[Auth] Google user not in localStorage, trying Firestore for:', email);
    localUser = await fetchUserFromFirestore(email, 2000);
  }
  if (!localUser) throw new Error('No account found for ' + email + '.\nAsk your admin to register this Google email.');
  if (!localUser.active) throw new Error('Your account has been deactivated. Contact admin.');
  if (expectedRole && localUser.role !== expectedRole) {
    throw new Error('This portal is for ' + expectedRole + 's only.\nYour account role is: ' + localUser.role + '.');
  }

  // ---- FAST PATH: Create session immediately, Firebase in background ----
  var session = {
    userId: localUser.id, firebaseUid: localUser.firebaseUid || null, role: localUser.role,
    email: localUser.email, name: localUser.name, department: localUser.department || '',
    section: localUser.section || '', loginAt: Date.now(), viaGoogle: true,
    sessionToken: generateSessionToken()
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  
  // Cache Google email → user ID for instant repeat logins
  setGoogleEmailMap(email, localUser.id);

  // ---- BACKGROUND: Sync Google credential with Firebase (non-blocking) ----
  (async function() {
    try {
      var googleCred = firebase.auth.GoogleAuthProvider.credential(credential);
      var userCredential = await auth.signInWithCredential(googleCred);
      var firebaseUid = userCredential.user.uid;

      // Update session with real Firebase UID
      session.firebaseUid = firebaseUid;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

      localUser.firebaseUid = firebaseUid;
      saveUser(localUser);

      var googleFirestoreData = {
        customId: localUser.id, email: localUser.email, name: localUser.name,
        role: localUser.role, department: localUser.department || '',
        section: localUser.section || '', active: localUser.active, lastLogin: Date.now()
      };
      if (localUser.passwordHash) googleFirestoreData.passwordHash = localUser.passwordHash;
      db.collection('users').doc(firebaseUid).set(googleFirestoreData, { merge: true }).catch(function(fsErr) {
        console.warn('[Auth] Google Firestore write failed:', fsErr.message);
      });

      console.log('[Auth] Background Google Firebase sync complete');
      
      // Start session listener now that Firebase Auth is ready
      if (typeof startSessionListener === 'function') {
        startSessionListener();
      }
    } catch(e) {
      console.warn('[Auth] Google Firebase auth background sync failed (login still works):', e.message);
      // Don't fall back to anonymous — it poisons auth state
    }
  })();

  return session;
}

// ---- Google Sign-In via Google Identity Services (GIS) ----
// Uses Google Identity Services (GIS) instead of Firebase popup for Google OAuth2.
// GIS initialization cache — only initialize once per page load
var _gisInitialized = false;
var _gisCallback = null;

function ensureGISInitialized() {
  if (_gisInitialized) return;
  _gisInitialized = true;
  google.accounts.id.initialize({
    client_id: '592918420084-qgj2566dvssfqboiv7bbassro1tui3eb.apps.googleusercontent.com',
    callback: function(response) {
      if (_gisCallback) _gisCallback(response);
    },
    cancel_on_tap_outside: false
  });
}

async function googleLoginWithPopup(expectedRole) {
  return new Promise(function(resolve, reject) {
    ensureGISInitialized();
    _gisCallback = async function(response) {
      try {
        var session = await googleLogin(response.credential, expectedRole);
        resolve(session);
      } catch(e) {
        reject(e);
      }
    };
    google.accounts.id.prompt(function(notification) {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        google.accounts.id.renderButton(
          document.getElementById('googleSignInWrap'),
          { theme: 'outline', size: 'large', width: 320 }
        );
      }
    });
  });
}

// ---- Session Listener (Event-Driven) ----
var _sessionUnsub = null;
var _sessionListenerStarted = false;

function startSessionListener() {
  var session = getSession();
  if (!session || !session.sessionToken) return;
  if (session.isDemo) return;
  if (typeof db === 'undefined') return;

  // If Firebase user is already available, start immediately
  var currentUser = auth.currentUser;
  if (currentUser && !currentUser.isAnonymous) {
    _doStartSessionListener(session);
    return;
  }

  // Otherwise, listen for auth state changes and start when real user signs in
  var unsub = auth.onAuthStateChanged(function(user) {
    if (user && !user.isAnonymous && !_sessionListenerStarted) {
      unsub(); // Stop listening once we start
      _doStartSessionListener(getSession() || session);
    }
  });
}

function _doStartSessionListener(session) {
  if (_sessionListenerStarted) return; // Idempotent — only start once
  _sessionListenerStarted = true;

  var docId = session.userId;
  var myToken = session.sessionToken;

  console.log('[Auth] Starting session listener for:', docId);

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

// Async version for cross-device login
async function validateCollegeEmailAsync(email) {
  var settings = await (typeof fetchSettingsFromFirestore === 'function' ? fetchSettingsFromFirestore() : Promise.resolve(getSettings()));
  var domain = settings.collegeDomain || 'college.edu';
  return email.toLowerCase().endsWith('@' + domain.toLowerCase());
}

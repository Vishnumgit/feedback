// ============================================================
// firebase-config.js — Firebase Initialization (Compat SDK)
// ============================================================
// Credentials are loaded from window.ENV which is populated by
// js/env-loader.js reading a git-ignored .env file.
// See .env.example for the required variables.

var _env = window.ENV || {};
const firebaseConfig = {
  apiKey:             _env.FIREBASE_API_KEY             || "",
  authDomain:         _env.FIREBASE_AUTH_DOMAIN         || "",
  projectId:          _env.FIREBASE_PROJECT_ID          || "",
  storageBucket:      _env.FIREBASE_STORAGE_BUCKET      || "",
  messagingSenderId:  _env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId:              _env.FIREBASE_APP_ID              || ""
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('[Firebase] Missing credentials. Copy .env.example to .env and fill in your Firebase credentials.');
  throw new Error('Firebase credentials not configured. See .env.example for setup instructions.');
}

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db   = firebase.firestore();
const auth = firebase.auth();
// firebase.functions() is only available when firebase-functions-compat.js is loaded.
// reset-password.html loads that SDK explicitly; other pages leave 'functions' undefined.
const functions = (typeof firebase.functions === 'function') ? firebase.functions() : null;

// ---- Auth State Ready Promise ----
var _authReady = false;
var _authReadyResolve = null;
var authReadyPromise = new Promise(function(resolve) {
  _authReadyResolve = resolve;
});

auth.onAuthStateChanged(function(user) {
  if (!user) {
    // No user signed in — auto sign-in anonymously so that authenticated
    // Firestore collections remain accessible from other pages.
    auth.signInAnonymously().catch(function(e) {
      console.warn('[Auth] Anonymous sign-in failed:', e.message);
      // Still resolve so the app doesn't hang
      if (!_authReady) { _authReady = true; _authReadyResolve(null); }
    });
    return; // onAuthStateChanged will fire again after anonymous sign-in
  }
  if (!_authReady) {
    _authReady = true;
    _authReadyResolve(user);
  }
});

function getFirebaseUser() {
  return auth.currentUser;
}

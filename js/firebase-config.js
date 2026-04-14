// ============================================================
// firebase-config.js — Firebase Initialization (Compat SDK)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyC9R2FKE9gwinvVocs92EtPjoFHG2TfDWM",
  authDomain: "student-feedback-form-489916.firebaseapp.com",
  projectId: "student-feedback-form-489916",
  storageBucket: "student-feedback-form-489916.firebasestorage.app",
  messagingSenderId: "592918420084",
  appId: "1:592918420084:web:2a263dafcd489826c2cf21"
};

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

// Gate for Firestore operations — resolves only when a REAL user is signed in
var _realAuthResolve = null;
var realAuthReadyPromise = new Promise(function(resolve) {
  _realAuthResolve = resolve;
});

auth.onAuthStateChanged(function(user) {
  // SECURITY FIX: No auto anonymous sign-in.
  if (!_authReady) {
    _authReady = true;
    _authReadyResolve(user || null);
  }
  // Resolve the real-auth gate when a non-anonymous user signs in
  if (user && !user.isAnonymous && _realAuthResolve) {
    _realAuthResolve(user);
    _realAuthResolve = null; // only resolve once
  }
});

// Timeout: if no real auth after 10s, resolve with null (skip Firestore sync)
setTimeout(function() {
  if (_realAuthResolve) {
    console.log('[Auth] No real auth after 10s — skipping Firestore sync');
    _realAuthResolve(null);
    _realAuthResolve = null;
  }
}, 10000);

function getFirebaseUser() {
  return auth.currentUser;
}

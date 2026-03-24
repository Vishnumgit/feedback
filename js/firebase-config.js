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
const db = firebase.firestore();
const auth = firebase.auth();

// ---- Auth State Ready Promise ----
var _authReady = false;
var _authReadyResolve = null;
var authReadyPromise = new Promise(function(resolve) {
  _authReadyResolve = resolve;
});

auth.onAuthStateChanged(function(user) {
  if (!_authReady) {
    _authReady = true;
    _authReadyResolve(user);
  }
});

function getFirebaseUser() {
  return auth.currentUser;
}

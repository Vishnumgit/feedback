'use strict';

// ============================================================
// functions/index.js — Cloud Functions for password-reset flow
// ============================================================
// Three callable functions replace direct Firestore access from
// reset-password.html so unauthenticated clients never touch
// Firestore (which requires request.auth != null in the rules).
//
// Environment variables (set via Firebase Functions config or
// Secret Manager before deploying):
//   EMAILJS_SERVICE_ID   — EmailJS service ID
//   EMAILJS_TEMPLATE_ID  — EmailJS template ID
//   EMAILJS_PUBLIC_KEY   — EmailJS public / user key
//   EMAILJS_PRIVATE_KEY  — EmailJS private / access token
// ============================================================

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions }   = require('firebase-functions/v2');
const admin  = require('firebase-admin');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Default region — change if you prefer a different one.
setGlobalOptions({ region: 'us-central1' });

admin.initializeApp();
const db = admin.firestore();

// ---- helpers ----

/** Send a transactional email via the EmailJS server-side REST API. */
async function sendViaEmailJS(templateParams) {
  const serviceId  = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey  = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    throw new Error('EmailJS environment variables are not configured.');
  }

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id:      serviceId,
      template_id:     templateId,
      user_id:         publicKey,
      accessToken:     privateKey,
      template_params: templateParams
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EmailJS API error ${response.status}: ${text}`);
  }
}

// ============================================================
// requestPasswordReset({ email })
// ============================================================
// Called from Step 1 (Forgot Password form).
// Always returns { success: true } to prevent account enumeration.
exports.requestPasswordReset = onCall(async (request) => {
  const email = ((request.data && request.data.email) || '').toLowerCase().trim();

  // Always return success — prevents account enumeration
  if (!email || !email.includes('@')) {
    return { success: true };
  }

  try {
    // Admin SDK bypasses Firestore security rules
    const usersSnap = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      return { success: true }; // user not found — don't reveal this
    }

    const userDoc  = usersSnap.docs[0];
    const userData = userDoc.data();

    if (userData.role === 'admin') {
      return { success: true }; // silently skip admin accounts
    }

    // Generate a cryptographically secure one-time token
    const token     = crypto.randomBytes(32).toString('hex');
    const now       = Date.now();
    const expiresAt = now + 60 * 60 * 1000; // 1 hour

    await db.collection('password_resets').doc(token).set({
      token,
      email,
      userId:    userDoc.id,
      userName:  userData.name || email,
      createdAt: now,
      expiresAt,
      used: false
    });

    // Build the reset link — falls back to the GitHub Pages URL if BASE_URL is not set
    const baseUrl   = process.env.BASE_URL ||
      'https://vishnumgit.github.io/feedback/reset-password.html';
    const resetLink = baseUrl + '?token=' + token;

    await sendViaEmailJS({ email, link: resetLink });

  } catch (err) {
    // Log server-side but never expose details to the client
    console.error('[requestPasswordReset] Error:', err.message);
  }

  return { success: true };
});

// ============================================================
// verifyResetToken({ token })
// ============================================================
// Called from Step 2 (reset-password.html on load with ?token=).
// Returns { valid: true, email } or { valid: false }.
exports.verifyResetToken = onCall(async (request) => {
  const token = (request.data && request.data.token) || '';

  if (!token) {
    return { valid: false };
  }

  try {
    const doc = await db.collection('password_resets').doc(token).get();

    if (!doc.exists) {
      return { valid: false };
    }

    const data = doc.data();

    if (data.used || Date.now() > data.expiresAt) {
      return { valid: false };
    }

    return { valid: true, email: data.email };
  } catch (err) {
    console.error('[verifyResetToken] Error:', err.message);
    return { valid: false };
  }
});

// ============================================================
// confirmPasswordReset({ token, newPassword })
// ============================================================
// Called from Step 3 (new-password form submission).
// Hashes the password with bcrypt (server-side), updates Firestore,
// updates Firebase Auth, marks the token as used, and returns
// the user's profile fields so the client can update localStorage.
exports.confirmPasswordReset = onCall(async (request) => {
  const token       = (request.data && request.data.token)       || '';
  const newPassword = (request.data && request.data.newPassword) || '';

  if (!token || !newPassword || newPassword.length < 6) {
    throw new HttpsError(
      'invalid-argument',
      'A valid token and a password of at least 6 characters are required.'
    );
  }

  // -- Validate the token --
  const docRef = db.collection('password_resets').doc(token);
  let tokenData;
  try {
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new HttpsError('not-found', 'Invalid or expired reset link. Please request a new one.');
    }
    tokenData = doc.data();
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError('internal', 'Failed to validate reset token.');
  }

  if (tokenData.used || Date.now() > tokenData.expiresAt) {
    throw new HttpsError(
      'failed-precondition',
      'This reset link has expired or has already been used.'
    );
  }

  try {
    // -- Hash with bcrypt (12 rounds) for secure Firestore storage --
    const bcryptHash = await bcrypt.hash(newPassword, 12);

    // -- Also compute SHA-256 (server-side) for localStorage compat --
    // The localStorage-based auth fallback compares against SHA-256.
    // Computing it here keeps all hashing server-side.
    const sha256Hash = crypto.createHash('sha256').update(newPassword).digest('hex');

    // -- Update Firestore user doc with bcrypt hash (Admin SDK) --
    await db.collection('users').doc(tokenData.userId).update({
      passwordHash: bcryptHash
    });

    // -- Update (or create) the Firebase Auth account --
    try {
      const userRecord = await admin.auth().getUserByEmail(tokenData.email);
      await admin.auth().updateUser(userRecord.uid, { password: newPassword });
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        // User hasn't been migrated to Firebase Auth yet — create them now
        // so signInWithEmailAndPassword works immediately after reset
        await admin.auth().createUser({
          uid:      tokenData.userId,
          email:    tokenData.email,
          password: newPassword
        });
      } else {
        // Non-blocking: log but don't fail the whole reset
        console.warn('[confirmPasswordReset] Firebase Auth update error:', authErr.message);
      }
    }

    // -- Mark token as used (one-time use) --
    await docRef.update({ used: true });

    // -- Return user profile so client can rebuild localStorage entry --
    const userSnap = await db.collection('users').doc(tokenData.userId).get();
    const userData  = userSnap.exists ? userSnap.data() : {};

    return {
      success: true,
      user: {
        id:           userData.customId  || tokenData.userId,
        email:        tokenData.email,
        name:         userData.name      || tokenData.userName || '',
        role:         userData.role      || 'student',
        department:   userData.department || '',
        section:      userData.section    || '',
        subjectId:    userData.subjectId  || null,
        rollNo:       userData.rollNo     || '',
        active:       userData.active !== false,
        firebaseUid:  tokenData.userId,
        // SHA-256 hash computed server-side for localStorage fallback auth
        passwordHash: sha256Hash
      }
    };

  } catch (err) {
    if (err instanceof HttpsError) throw err;
    console.error('[confirmPasswordReset] Error:', err.message);
    throw new HttpsError('internal', 'Failed to reset password. Please try again.');
  }
});

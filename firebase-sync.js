// ============================================================
// firebase-sync.js — NON-BLOCKING background sync
// ============================================================
// Usage in each HTML page:
//   Call fbInit() at the TOP of the inline <script>.
//   All other code (functions, event listeners) stays GLOBAL
//   so HTML onclick="fn()" handlers work correctly.
// ============================================================

// ------ Firestore write helpers ------
function fsSetDoc(collection, docId, data) {
  db.collection(collection).doc(docId).set(data)
    .catch(e => console.warn('[Firebase] Write failed:', collection, docId, e.message));
}
function fsDeleteDoc(collection, docId) {
  db.collection(collection).doc(docId).delete()
    .catch(e => console.warn('[Firebase] Delete failed:', collection, docId, e.message));
}

// ------ Background sync: Firestore → localStorage (runs after page init) ------
function syncFromFirestoreInBackground() {
  setTimeout(async function() {
    try {
      const [usersSnap, subjectsSnap, qSnap, enrollSnap, responsesSnap, settingsDoc, attendanceSnap] =
        await Promise.all([
          db.collection('users').get(),
          db.collection('subjects').get(),
          db.collection('questionnaires').get(),
          db.collection('enrollments').get(),
          db.collection('responses').get(),
          db.collection('settings').doc('global').get(),
          db.collection('attendance').get()
        ]);

      const toArray = snap => { const a = []; snap.forEach(d => a.push(d.data())); return a; };
      const toObj   = snap => { const o = {}; snap.forEach(d => { o[d.id] = d.data(); }); return o; };

      const users          = toArray(usersSnap);
      const subjects       = toArray(subjectsSnap);
      const questionnaires = toObj(qSnap);
      const enrollments    = toArray(enrollSnap);
      const responses      = toArray(responsesSnap);
      const attendance     = toArray(attendanceSnap);
      const settings       = settingsDoc.exists ? settingsDoc.data() : null;

      // Only overwrite localStorage if Firestore has data
      if (users.length)                       localStorage.setItem('sfft_users',          JSON.stringify(users));
      if (subjects.length)                    localStorage.setItem('sfft_subjects',        JSON.stringify(subjects));
      if (Object.keys(questionnaires).length) localStorage.setItem('sfft_questionnaires', JSON.stringify(questionnaires));
      if (enrollments.length)                 localStorage.setItem('sfft_enrollments',     JSON.stringify(enrollments));
      if (responses.length)                   localStorage.setItem('sfft_responses',       JSON.stringify(responses));
      if (attendance.length)                  localStorage.setItem('sfft_attendance',      JSON.stringify(attendance));
      if (settings)                           localStorage.setItem('sfft_settings',        JSON.stringify(settings));

      console.log('[Firebase] Background sync complete ✅');
    } catch(e) {
      console.warn('[Firebase] Background sync failed (offline?):', e.message);
    }

    // Push seed data to Firestore if it is empty (first-time setup)
    pushSeedDataIfEmpty();
  }, 100); // tiny delay so page renders first
}

async function pushSeedDataIfEmpty() {
  try {
    const snap = await db.collection('users').limit(1).get();
    if (!snap.empty) return;

    console.log('[Firebase] Firestore is empty — pushing seed data…');
    const users    = JSON.parse(localStorage.getItem('sfft_users')          || '[]');
    const subjects = JSON.parse(localStorage.getItem('sfft_subjects')       || '[]');
    const qAll     = JSON.parse(localStorage.getItem('sfft_questionnaires') || '{}');
    const settings = JSON.parse(localStorage.getItem('sfft_settings')       || '{}');

    if (!users.length) return; // nothing to push yet

    const batch = db.batch();
    users.forEach(u    => batch.set(db.collection('users').doc(u.id), u));
    subjects.forEach(s => batch.set(db.collection('subjects').doc(s.id), s));
    Object.entries(qAll).forEach(([id, q]) => batch.set(db.collection('questionnaires').doc(id), q));
    if (settings && settings.collegeName) batch.set(db.collection('settings').doc('global'), settings);
    await batch.commit();
    console.log('[Firebase] Seed data pushed ✅');
  } catch(e) {
    console.warn('[Firebase] Seed push failed:', e.message);
  }
}

// ------ Patch data.js write functions to also sync to Firestore ------
function patchDataFunctions() {

  // ---- Users ----
  const _addUser = window.addUser;
  window.addUser = function(userData) {
    const result = _addUser(userData);
    const users = JSON.parse(localStorage.getItem('sfft_users') || '[]');
    const newUser = users[users.length - 1];
    if (newUser) fsSetDoc('users', newUser.id, newUser);
    return result;
  };

  const _saveUser = window.saveUser;
  window.saveUser = function(user) {
    const result = _saveUser(user);
    fsSetDoc('users', user.id, user);
    return result;
  };

  const _deleteUser = window.deleteUser;
  window.deleteUser = function(userId) {
    const result = _deleteUser(userId);
    fsDeleteDoc('users', userId);
    return result;
  };

  // ---- Subjects ----
  const _addSubject = window.addSubject;
  window.addSubject = function(subjectData) {
    const result = _addSubject(subjectData);
    const subjects = JSON.parse(localStorage.getItem('sfft_subjects') || '[]');
    const newSub = subjects[subjects.length - 1];
    if (newSub) fsSetDoc('subjects', newSub.id, newSub);
    return result;
  };

  const _deleteSubject = window.deleteSubject;
  window.deleteSubject = function(subjectId) {
    const result = _deleteSubject(subjectId);
    fsDeleteDoc('subjects', subjectId);
    fsDeleteDoc('questionnaires', subjectId);
    return result;
  };

  // ---- Questionnaires ----
  const _saveQuestionnaire = window.saveQuestionnaire;
  window.saveQuestionnaire = function(subjectId, data) {
    const result = _saveQuestionnaire(subjectId, data);
    fsSetDoc('questionnaires', subjectId, data);
    return result;
  };

  // ---- Enrollments ----
  const _enroll = window.enroll;
  window.enroll = function(studentId, teacherId) {
    const result = _enroll(studentId, teacherId);
    const enrollments = JSON.parse(localStorage.getItem('sfft_enrollments') || '[]');
    const e = enrollments.find(e => e.studentId === studentId && e.teacherId === teacherId);
    if (e) fsSetDoc('enrollments', `${studentId}_${teacherId}`, e);
    return result;
  };

  const _unenroll = window.unenroll;
  window.unenroll = function(studentId, teacherId) {
    const result = _unenroll(studentId, teacherId);
    fsDeleteDoc('enrollments', `${studentId}_${teacherId}`);
    return result;
  };

  // ---- Responses ----
  const _addResponse = window.addResponse;
  window.addResponse = function(responseData) {
    const result = _addResponse(responseData);
    const responses = JSON.parse(localStorage.getItem('sfft_responses') || '[]');
    const newResp = responses[responses.length - 1];
    if (newResp) fsSetDoc('responses', newResp.id, newResp);
    return result;
  };

  // ---- Settings ----
  const _saveSettings = window.saveSettings;
  window.saveSettings = function(settings) {
    const result = _saveSettings(settings);
    const s = JSON.parse(localStorage.getItem('sfft_settings') || '{}');
    fsSetDoc('settings', 'global', s);
    return result;
  };

  // ---- Attendance ----
  const _saveAttendanceRecords = window.saveAttendanceRecords;
  window.saveAttendanceRecords = function(records) {
    const result = _saveAttendanceRecords(records);
    // Each attendance record is keyed by studentId
    const allRecords = JSON.parse(localStorage.getItem('sfft_attendance') || '[]');
    records.forEach(rec => {
      const saved = allRecords.find(a => a.studentId === rec.studentId);
      if (saved) fsSetDoc('attendance', saved.studentId, saved);
    });
    return result;
  };
}


// ------ Main entry point: call at TOP of each page's <script> ------
// fbInit() runs instantly (no blocking). All page functions must stay
// at global scope (NOT inside a callback) for onclick handlers to work.
window.fbInit = function() {
  if (typeof initDB === 'function') initDB();  // load from localStorage immediately
  patchDataFunctions();                         // mirror future writes to Firestore
  syncFromFirestoreInBackground();              // pull latest Firestore data in background
};

// Alias kept for any legacy usage
window.startApp = function(callback) {
  window.fbInit();
  if (typeof callback === 'function') callback();
};

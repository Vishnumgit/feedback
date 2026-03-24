// ============================================================
// firebase-sync.js — OPTIMIZED: Filtered queries, Role-based sync, Cache
// ============================================================
// Solutions applied:
//   1. Filtered Queries — students/teachers only fetch their own data
//   2. Role-Based Sync — different sync per role (student/teacher/admin)
//   3. Cache Timestamps — skip sync if data is less than 5 minutes old
// ============================================================

// ------ Firestore write helpers (unchanged) ------
function fsSetDoc(collection, docId, data) {
  // For users collection, prefer Firebase UID as document key
  var finalDocId = docId;
  if (collection === 'users' && data && data.firebaseUid) {
    finalDocId = data.firebaseUid;
  }
  db.collection(collection).doc(finalDocId).set(data)
    .catch(function(e) { console.warn('[Firebase] Write failed:', collection, finalDocId, e.message); });
}
function fsDeleteDoc(collection, docId) {
  db.collection(collection).doc(docId).delete()
    .catch(function(e) { console.warn('[Firebase] Delete failed:', collection, docId, e.message); });
}

// ------ Merge helpers (update without overwriting entire arrays) ------
function mergeById(arr, item) {
  var idx = -1;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].id === item.id) { idx = i; break; }
    // Fallback: match by email to prevent duplicates from dual-keyed Firestore docs
    if (item.email && arr[i].email && arr[i].email.toLowerCase() === item.email.toLowerCase()) { idx = i; break; }
  }
  if (idx > -1) {
    // Merge: keep existing fields, overlay with new data
    arr[idx] = Object.assign({}, arr[idx], item);
    // Preserve the original id if the new item lacks one
    if (!item.id && arr[idx].customId) arr[idx].id = arr[idx].id || arr[idx].customId;
  } else {
    arr.push(item);
  }
}

function mergeByField(arr, item, field) {
  var idx = -1;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i][field] === item[field]) { idx = i; break; }
  }
  if (idx > -1) arr[idx] = item; else arr.push(item);
}

// ------ SOLUTION 3: Cache with Timestamps ------
var SYNC_CACHE_KEY = 'sfft_lastSync';
var SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

function shouldSync() {
  var lastSync = localStorage.getItem(SYNC_CACHE_KEY);
  if (!lastSync) return true;
  return (Date.now() - Number(lastSync)) >= SYNC_INTERVAL;
}

function markSynced() {
  localStorage.setItem(SYNC_CACHE_KEY, String(Date.now()));
}

// Force sync (bypass cache) — useful after data changes
function forceSync() {
  localStorage.removeItem(SYNC_CACHE_KEY);
  syncFromFirestoreInBackground();
}

// ------ SOLUTION 1 + 2: Role-Based Filtered Sync ------
function syncFromFirestoreInBackground() {
  // Solution 3: Skip if recently synced
  if (!shouldSync()) {
    console.log('[Firebase] Skipping sync — data is fresh (< 5 min)');
    window.dispatchEvent(new Event('firestore-synced'));
    return;
  }

  // Solution 2: Route by role
  var session = (typeof getSession === 'function') ? getSession() : null;

  setTimeout(async function() {
    // Wait for Firebase Auth if available
    if (typeof authReadyPromise !== 'undefined') {
      try { await authReadyPromise; } catch(e) {}
    }
    try {
      if (session && session.role === 'student') {
        await syncStudentData(session.userId);
      } else if (session && session.role === 'teacher') {
        await syncTeacherData(session.userId);
      } else {
        // Admin or no session — full sync (original behavior)
        await syncAllData();
      }

      markSynced();
      console.log('[Firebase] Background sync complete ✅');
      window.dispatchEvent(new Event('firestore-synced'));
    } catch(e) {
      console.warn('[Firebase] Background sync failed (offline?):', e.message);
    }

    pushSeedDataIfEmpty();
  }, 100);
}

// ------ STUDENT SYNC: Only fetch student-relevant data ------
async function syncStudentData(studentId) {
  console.log('[Firebase] Student sync — filtered queries for:', studentId);

  // Step 1: Fetch student's own data + filtered collections
  var results = await Promise.all([
    db.collection('users').doc(studentId).get(),
    db.collection('enrollments').where('studentId', '==', studentId).get(),
    db.collection('subjects').get(),
    db.collection('settings').doc('global').get(),
    db.collection('attendance').doc(studentId).get(),
    db.collection('responses').where('studentId', '==', studentId).get()
  ]);

  var myUserDoc = results[0];
  var myEnrollmentsSnap = results[1];
  var subjectsSnap = results[2];
  var settingsDoc = results[3];
  var myAttendanceDoc = results[4];
  var myResponsesSnap = results[5];

  // Step 2: Extract enrollments and find teacher IDs
  var enrollments = [];
  var teacherIds = [];
  myEnrollmentsSnap.forEach(function(d) {
    var data = d.data();
    enrollments.push(data);
    if (data.teacherId && teacherIds.indexOf(data.teacherId) === -1) {
      teacherIds.push(data.teacherId);
    }
  });

  // Step 3: Fetch only enrolled teachers' user docs
  var teacherDocs = [];
  if (teacherIds.length > 0) {
    teacherDocs = await Promise.all(
      teacherIds.map(function(tid) {
        return db.collection('users').doc(tid).get();
      })
    );
  }

  // Step 4: Fetch questionnaires for enrolled subjects only
  var subjectIds = [];
  enrollments.forEach(function(e) {
    (e.subjectIds || []).forEach(function(sid) {
      if (subjectIds.indexOf(sid) === -1) subjectIds.push(sid);
    });
  });

  var qDocs = [];
  if (subjectIds.length > 0) {
    qDocs = await Promise.all(
      subjectIds.map(function(sid) {
        return db.collection('questionnaires').doc(sid).get();
      })
    );
  }

  // Step 5: MERGE into localStorage (don't overwrite entire arrays!)

  // Users: merge my doc + teacher docs
  var existingUsers = JSON.parse(localStorage.getItem('sfft_users') || '[]');
  if (myUserDoc.exists) mergeById(existingUsers, myUserDoc.data());
  teacherDocs.forEach(function(d) {
    if (d.exists) mergeById(existingUsers, d.data());
  });
  localStorage.setItem('sfft_users', JSON.stringify(existingUsers));

  // Enrollments: replace student's enrollments, keep others
  var existingEnrollments = JSON.parse(localStorage.getItem('sfft_enrollments') || '[]');
  var otherEnrollments = existingEnrollments.filter(function(e) { return e.studentId !== studentId; });
  localStorage.setItem('sfft_enrollments', JSON.stringify(otherEnrollments.concat(enrollments)));

  // Subjects: full replace (small collection, OK to read all)
  var subjectsArr = [];
  subjectsSnap.forEach(function(d) { subjectsArr.push(d.data()); });
  if (subjectsArr.length) localStorage.setItem('sfft_subjects', JSON.stringify(subjectsArr));

  // Questionnaires: merge enrolled subjects' questionnaires
  var existingQ = JSON.parse(localStorage.getItem('sfft_questionnaires') || '{}');
  qDocs.forEach(function(d) {
    if (d.exists) existingQ[d.id] = d.data();
  });
  localStorage.setItem('sfft_questionnaires', JSON.stringify(existingQ));

  // Attendance: merge my record
  if (myAttendanceDoc.exists) {
    var existingAtt = JSON.parse(localStorage.getItem('sfft_attendance') || '[]');
    mergeByField(existingAtt, myAttendanceDoc.data(), 'studentId');
    localStorage.setItem('sfft_attendance', JSON.stringify(existingAtt));
  }

  // Responses: UNION local + Firestore (don't lose local responses not yet in Firestore)
  var responses = [];
  myResponsesSnap.forEach(function(d) { responses.push(d.data()); });
  var existingResp = JSON.parse(localStorage.getItem('sfft_responses') || '[]');
  var otherResp = existingResp.filter(function(r) { return r.studentId !== studentId; });
  var myLocalResp = existingResp.filter(function(r) { return r.studentId === studentId; });
  if (responses.length > 0) {
    // Keep local responses that aren't in Firestore yet (race condition protection)
    var firestoreIds = {};
    responses.forEach(function(r) { firestoreIds[r.id] = true; });
    var localOnly = myLocalResp.filter(function(r) { return !firestoreIds[r.id]; });
    localStorage.setItem('sfft_responses', JSON.stringify(otherResp.concat(responses).concat(localOnly)));
  } else if (myLocalResp.length > 0) {
    // No Firestore data but local data exists — keep it
    localStorage.setItem('sfft_responses', JSON.stringify(existingResp));
  }

  // Settings: single document
  if (settingsDoc.exists) localStorage.setItem('sfft_settings', JSON.stringify(settingsDoc.data()));

  console.log('[Firebase] Student sync done — used filtered queries ✅');
}

// ------ TEACHER SYNC: Only fetch teacher-relevant data ------
async function syncTeacherData(teacherId) {
  console.log('[Firebase] Teacher sync — filtered queries for:', teacherId);

  // Step 1: Fetch teacher's own data + their responses/enrollments
  var results = await Promise.all([
    db.collection('users').doc(teacherId).get(),
    db.collection('enrollments').where('teacherId', '==', teacherId).get(),
    db.collection('responses').where('teacherId', '==', teacherId).get(),
    db.collection('subjects').get(),
    db.collection('questionnaires').get(),
    db.collection('settings').doc('global').get()
  ]);

  var myUserDoc = results[0];
  var myEnrollmentsSnap = results[1];
  var myResponsesSnap = results[2];
  var subjectsSnap = results[3];
  var qSnap = results[4];
  var settingsDoc = results[5];

  // Step 2: Extract enrollments and find student IDs
  var enrollments = [];
  var studentIds = [];
  myEnrollmentsSnap.forEach(function(d) {
    var data = d.data();
    enrollments.push(data);
    if (data.studentId && studentIds.indexOf(data.studentId) === -1) {
      studentIds.push(data.studentId);
    }
  });

  // Step 3: Fetch enrolled students' user docs
  var studentDocs = [];
  if (studentIds.length > 0) {
    studentDocs = await Promise.all(
      studentIds.map(function(sid) {
        return db.collection('users').doc(sid).get();
      })
    );
  }

  // Step 4: Extract responses
  var responses = [];
  myResponsesSnap.forEach(function(d) { responses.push(d.data()); });

  // Step 5: MERGE into localStorage

  // Users: merge my doc + student docs
  var existingUsers = JSON.parse(localStorage.getItem('sfft_users') || '[]');
  if (myUserDoc.exists) mergeById(existingUsers, myUserDoc.data());
  studentDocs.forEach(function(d) {
    if (d.exists) mergeById(existingUsers, d.data());
  });
  localStorage.setItem('sfft_users', JSON.stringify(existingUsers));

  // Enrollments: replace teacher's enrollments, keep others
  var existingEnrollments = JSON.parse(localStorage.getItem('sfft_enrollments') || '[]');
  var otherEnrollments = existingEnrollments.filter(function(e) { return e.teacherId !== teacherId; });
  localStorage.setItem('sfft_enrollments', JSON.stringify(otherEnrollments.concat(enrollments)));

  // Responses: replace teacher's responses, keep others
  var existingResp = JSON.parse(localStorage.getItem('sfft_responses') || '[]');
  var otherResp = existingResp.filter(function(r) { return r.teacherId !== teacherId; });
  localStorage.setItem('sfft_responses', JSON.stringify(otherResp.concat(responses)));

  // Subjects: full replace
  var subjectsArr = [];
  subjectsSnap.forEach(function(d) { subjectsArr.push(d.data()); });
  if (subjectsArr.length) localStorage.setItem('sfft_subjects', JSON.stringify(subjectsArr));

  // Questionnaires: full replace (teachers may need all for reference)
  var questionnaires = {};
  qSnap.forEach(function(d) { questionnaires[d.id] = d.data(); });
  if (Object.keys(questionnaires).length) localStorage.setItem('sfft_questionnaires', JSON.stringify(questionnaires));

  // Settings
  if (settingsDoc.exists) localStorage.setItem('sfft_settings', JSON.stringify(settingsDoc.data()));

  console.log('[Firebase] Teacher sync done — used filtered queries ✅');
}

// ------ ADMIN SYNC: Full sync (original behavior) ------
async function syncAllData() {
  console.log('[Firebase] Admin/full sync — all collections');

  var results = await Promise.all([
    db.collection('users').get(),
    db.collection('subjects').get(),
    db.collection('questionnaires').get(),
    db.collection('enrollments').get(),
    db.collection('responses').get(),
    db.collection('settings').doc('global').get(),
    db.collection('attendance').get()
  ]);

  var toArray = function(snap) { var a = []; snap.forEach(function(d) { a.push(d.data()); }); return a; };
  var toObj   = function(snap) { var o = {}; snap.forEach(function(d) { o[d.id] = d.data(); }); return o; };

  var users          = toArray(results[0]);
  // Deduplicate users by email (dual-keyed Firestore docs can cause duplicates)
  var seen = {};
  users = users.filter(function(u) {
    var key = (u.email || '').toLowerCase();
    if (!key) return true; // keep users without email
    if (seen[key]) {
      // Merge into the existing entry (keep the one with more data)
      Object.assign(seen[key], u);
      return false;
    }
    seen[key] = u;
    return true;
  });
  var subjects       = toArray(results[1]);
  var questionnaires = toObj(results[2]);
  var enrollments    = toArray(results[3]);
  var responses      = toArray(results[4]);
  var settings       = results[5].exists ? results[5].data() : null;
  var attendance     = toArray(results[6]);

  if (users.length)                       localStorage.setItem('sfft_users',          JSON.stringify(users));
  if (subjects.length)                    localStorage.setItem('sfft_subjects',        JSON.stringify(subjects));
  if (Object.keys(questionnaires).length) localStorage.setItem('sfft_questionnaires', JSON.stringify(questionnaires));
  if (enrollments.length)                 localStorage.setItem('sfft_enrollments',     JSON.stringify(enrollments));
  if (responses.length)                   localStorage.setItem('sfft_responses',       JSON.stringify(responses));
  if (attendance.length)                  localStorage.setItem('sfft_attendance',      JSON.stringify(attendance));
  if (settings)                           localStorage.setItem('sfft_settings',        JSON.stringify(settings));
}

// ------ Seed data push (unchanged) ------
async function pushSeedDataIfEmpty() {
  try {
    var snap = await db.collection('users').limit(1).get();
    if (!snap.empty) return;

    console.log('[Firebase] Firestore is empty — pushing seed data…');
    var users    = JSON.parse(localStorage.getItem('sfft_users')          || '[]');
    var subjects = JSON.parse(localStorage.getItem('sfft_subjects')       || '[]');
    var qAll     = JSON.parse(localStorage.getItem('sfft_questionnaires') || '{}');
    var settings = JSON.parse(localStorage.getItem('sfft_settings')       || '{}');

    if (!users.length) return;

    var batch = db.batch();
    users.forEach(function(u) { batch.set(db.collection('users').doc(u.id), u); });
    subjects.forEach(function(s) { batch.set(db.collection('subjects').doc(s.id), s); });
    Object.entries(qAll).forEach(function(entry) { batch.set(db.collection('questionnaires').doc(entry[0]), entry[1]); });
    if (settings && settings.collegeName) batch.set(db.collection('settings').doc('global'), settings);
    await batch.commit();
    console.log('[Firebase] Seed data pushed ✅');
  } catch(e) {
    console.warn('[Firebase] Seed push failed:', e.message);
  }
}

// ------ Patch data.js write functions (unchanged, but clears sync cache on write) ------
function patchDataFunctions() {

  // ---- Users ----
  var _addUser = window.addUser;
  window.addUser = function(userData) {
    var result = _addUser(userData);
    var users = JSON.parse(localStorage.getItem('sfft_users') || '[]');
    var newUser = users[users.length - 1];
    if (newUser) fsSetDoc('users', newUser.id, newUser);
    localStorage.removeItem(SYNC_CACHE_KEY); // Clear cache so next load re-syncs
    return result;
  };

  var _saveUser = window.saveUser;
  window.saveUser = function(user) {
    var result = _saveUser(user);
    fsSetDoc('users', user.id, user);
    return result;
  };

  var _deleteUser = window.deleteUser;
  window.deleteUser = function(userId) {
    var result = _deleteUser(userId);
    fsDeleteDoc('users', userId);
    localStorage.removeItem(SYNC_CACHE_KEY);
    return result;
  };

  // ---- Subjects ----
  var _addSubject = window.addSubject;
  window.addSubject = function(subjectData) {
    var result = _addSubject(subjectData);
    var subjects = JSON.parse(localStorage.getItem('sfft_subjects') || '[]');
    var newSub = subjects[subjects.length - 1];
    if (newSub) fsSetDoc('subjects', newSub.id, newSub);
    return result;
  };

  var _deleteSubject = window.deleteSubject;
  window.deleteSubject = function(subjectId) {
    var result = _deleteSubject(subjectId);
    fsDeleteDoc('subjects', subjectId);
    fsDeleteDoc('questionnaires', subjectId);
    return result;
  };

  // ---- Questionnaires ----
  var _saveQuestionnaire = window.saveQuestionnaire;
  window.saveQuestionnaire = function(subjectId, data) {
    var result = _saveQuestionnaire(subjectId, data);
    fsSetDoc('questionnaires', subjectId, data);
    return result;
  };

  // ---- Enrollments ----
  var _enroll = window.enroll;
  window.enroll = function(studentId, teacherId, subjectIds) {
    var result = _enroll(studentId, teacherId, subjectIds);
    var enrollments = JSON.parse(localStorage.getItem('sfft_enrollments') || '[]');
    var e = enrollments.find(function(e) { return e.studentId === studentId && e.teacherId === teacherId; });
    if (e) fsSetDoc('enrollments', studentId + '_' + teacherId, e);
    localStorage.removeItem(SYNC_CACHE_KEY);
    return result;
  };

  var _unenroll = window.unenroll;
  window.unenroll = function(studentId, teacherId, subjectIds) {
    var result = _unenroll(studentId, teacherId, subjectIds);
    var enrollments = JSON.parse(localStorage.getItem('sfft_enrollments') || '[]');
    var e = enrollments.find(function(e) { return e.studentId === studentId && e.teacherId === teacherId; });
    if (e) {
      fsSetDoc('enrollments', studentId + '_' + teacherId, e);
    } else {
      fsDeleteDoc('enrollments', studentId + '_' + teacherId);
    }
    localStorage.removeItem(SYNC_CACHE_KEY);
    return result;
  };

  // ---- Responses ----
  var _addResponse = window.addResponse;
  if (_addResponse) {
    window.addResponse = function(responseData) {
      var result = _addResponse(responseData);
      var responses = JSON.parse(localStorage.getItem('sfft_responses') || '[]');
      var newResp = responses[responses.length - 1];
      if (newResp) fsSetDoc('responses', newResp.id, newResp);
      return result;
    };
  }

  var _saveResponse = window.saveResponse;
  if (_saveResponse) {
    window.saveResponse = function(data) {
      var result = _saveResponse(data);
      var responses = JSON.parse(localStorage.getItem('sfft_responses') || '[]');
      var saved = responses.find(function(r) { return r.studentId === data.studentId && r.teacherId === data.teacherId; });
      if (saved) fsSetDoc('responses', saved.id, saved);
      return result;
    };
  }

  var _deleteResponse = window.deleteResponse;
  if (_deleteResponse) {
    window.deleteResponse = function(responseId) {
      var result = _deleteResponse(responseId);
      fsDeleteDoc('responses', responseId);
      return result;
    };
  }

  var _deleteResponses = window.deleteResponses;
  if (_deleteResponses) {
    window.deleteResponses = function(responseIds) {
      var result = _deleteResponses(responseIds);
      responseIds.forEach(function(id) { fsDeleteDoc('responses', id); });
      return result;
    };
  }

  var _clearAllResponses = window.clearAllResponses;
  if (_clearAllResponses) {
    window.clearAllResponses = function() {
      var responses = JSON.parse(localStorage.getItem('sfft_responses') || '[]');
      var result = _clearAllResponses();
      responses.forEach(function(r) { fsDeleteDoc('responses', r.id); });
      return result;
    };
  }

  // ---- Settings ----
  var _saveSettings = window.saveSettings;
  window.saveSettings = function(settings) {
    var result = _saveSettings(settings);
    var s = JSON.parse(localStorage.getItem('sfft_settings') || '{}');
    fsSetDoc('settings', 'global', s);
    return result;
  };

  // ---- Attendance ----
  var _saveAttendanceRecords = window.saveAttendanceRecords;
  window.saveAttendanceRecords = function(records) {
    var result = _saveAttendanceRecords(records);
    var allRecords = JSON.parse(localStorage.getItem('sfft_attendance') || '[]');
    records.forEach(function(rec) {
      var saved = allRecords.find(function(a) { return a.studentId === rec.studentId; });
      if (saved) fsSetDoc('attendance', saved.studentId, saved);
    });
    return result;
  };
}


// ------ Main entry point (unchanged interface) ------
window.fbInit = function() {
  if (typeof initDB === 'function') initDB();
  patchDataFunctions();
  syncFromFirestoreInBackground();
};

window.startApp = function(callback) {
  window.fbInit();
  if (typeof callback === 'function') callback();
};

// Expose forceSync for manual re-sync
window.forceSync = forceSync;

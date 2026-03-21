// ============================================================
// firebase-sync.js — NON-BLOCKING background sync (REST API version)
// ============================================================
// Zero persistent connections. Supports 1,000+ concurrent users.
// ============================================================

function fsSetDoc(collection, docId, data) {
  FirestoreREST.setDoc(collection, docId, data)
    .catch(function(e) { console.warn('[REST] Write failed:', collection, docId, e.message); });
}
function fsDeleteDoc(collection, docId) {
  FirestoreREST.deleteDoc(collection, docId)
    .catch(function(e) { console.warn('[REST] Delete failed:', collection, docId, e.message); });
}

function syncFromFirestoreInBackground() {
  setTimeout(function() {
    var allPromises = [];
    var arrayCollections = ['users', 'subjects', 'enrollments', 'responses', 'attendance'];
    arrayCollections.forEach(function(col) {
      allPromises.push(
        FirestoreREST.getCollection(col).then(function(docs) {
          if (docs.length) localStorage.setItem('sfft_' + col, JSON.stringify(docs));
          return { name: col, count: docs.length };
        }).catch(function(e) { return { name: col, count: 0 }; })
      );
    });
    allPromises.push(
      fetch('https://firestore.googleapis.com/v1/projects/' + FirestoreREST.PROJECT_ID +
        '/databases/(default)/documents/questionnaires?key=AIzaSyC9R2FKE9gwinvVocs92EtPjoFHG2TfDWM&pageSize=1000')
        .then(function(r) { return r.json(); }).then(function(data) {
          if (!data.documents) return { name: 'questionnaires', count: 0 };
          var obj = {};
          data.documents.forEach(function(doc) {
            var parts = doc.name.split('/');
            obj[parts[parts.length - 1]] = FirestoreREST.fromFirestoreFields(doc.fields);
          });
          if (Object.keys(obj).length) localStorage.setItem('sfft_questionnaires', JSON.stringify(obj));
          return { name: 'questionnaires', count: Object.keys(obj).length };
        }).catch(function() { return { name: 'questionnaires', count: 0 }; })
    );
    allPromises.push(
      FirestoreREST.getDoc('settings', 'global').then(function(doc) {
        if (doc) localStorage.setItem('sfft_settings', JSON.stringify(doc));
        return { name: 'settings', count: doc ? 1 : 0 };
      }).catch(function() { return { name: 'settings', count: 0 }; })
    );
    Promise.all(allPromises).then(function(results) {
      console.log('[REST] Sync complete', results.map(function(r) { return r.name + ':' + r.count; }).join(', '));
      window.dispatchEvent(new Event('firestore-synced'));
      pushSeedDataIfEmpty();
    });
  }, 100);
}

function pushSeedDataIfEmpty() {
  FirestoreREST.getCollection('users').then(function(docs) {
    if (docs.length > 0) return;
    var users = JSON.parse(localStorage.getItem('sfft_users') || '[]');
    var subjects = JSON.parse(localStorage.getItem('sfft_subjects') || '[]');
    var qAll = JSON.parse(localStorage.getItem('sfft_questionnaires') || '{}');
    var settings = JSON.parse(localStorage.getItem('sfft_settings') || '{}');
    if (!users.length) return;
    var p = [];
    users.forEach(function(u) { p.push(FirestoreREST.setDoc('users', u.id, u)); });
    subjects.forEach(function(s) { p.push(FirestoreREST.setDoc('subjects', s.id, s)); });
    Object.keys(qAll).forEach(function(id) { p.push(FirestoreREST.setDoc('questionnaires', id, qAll[id])); });
    if (settings.collegeName) p.push(FirestoreREST.setDoc('settings', 'global', settings));
    return Promise.all(p);
  }).catch(function(e) { console.warn('[REST] Seed check failed:', e.message); });
}

function patchDataFunctions() {
  var _addUser = window.addUser;
  window.addUser = function(d) { var r = _addUser(d); var u = JSON.parse(localStorage.getItem('sfft_users')||'[]'); var n=u[u.length-1]; if(n) fsSetDoc('users',n.id,n); return r; };
  var _saveUser = window.saveUser;
  window.saveUser = function(u) { var r = _saveUser(u); fsSetDoc('users',u.id,u); return r; };
  var _deleteUser = window.deleteUser;
  window.deleteUser = function(id) { var r = _deleteUser(id); fsDeleteDoc('users',id); return r; };
  var _addSubject = window.addSubject;
  window.addSubject = function(d) { var r = _addSubject(d); var s = JSON.parse(localStorage.getItem('sfft_subjects')||'[]'); var n=s[s.length-1]; if(n) fsSetDoc('subjects',n.id,n); return r; };
  var _deleteSubject = window.deleteSubject;
  window.deleteSubject = function(id) { var r = _deleteSubject(id); fsDeleteDoc('subjects',id); fsDeleteDoc('questionnaires',id); return r; };
  var _saveQuestionnaire = window.saveQuestionnaire;
  window.saveQuestionnaire = function(id,d) { var r = _saveQuestionnaire(id,d); fsSetDoc('questionnaires',id,d); return r; };
  var _enroll = window.enroll;
  window.enroll = function(s,t,ids) { var r = _enroll(s,t,ids); var e = JSON.parse(localStorage.getItem('sfft_enrollments')||'[]').find(function(x){return x.studentId===s&&x.teacherId===t;}); if(e) fsSetDoc('enrollments',s+'_'+t,e); return r; };
  var _unenroll = window.unenroll;
  window.unenroll = function(s,t,ids) { var r = _unenroll(s,t,ids); var e = JSON.parse(localStorage.getItem('sfft_enrollments')||'[]').find(function(x){return x.studentId===s&&x.teacherId===t;}); if(e) fsSetDoc('enrollments',s+'_'+t,e); else fsDeleteDoc('enrollments',s+'_'+t); return r; };
  var _saveResponse = window.saveResponse;
  if(_saveResponse) window.saveResponse = function(d) { var r = _saveResponse(d); var a=JSON.parse(localStorage.getItem('sfft_responses')||'[]'); var s=a.find(function(x){return x.studentId===d.studentId&&x.teacherId===d.teacherId;}); if(s) fsSetDoc('responses',s.id,s); return r; };
  var _deleteResponse = window.deleteResponse;
  if(_deleteResponse) window.deleteResponse = function(id) { var r = _deleteResponse(id); fsDeleteDoc('responses',id); return r; };
  var _deleteResponses = window.deleteResponses;
  if(_deleteResponses) window.deleteResponses = function(ids) { var r = _deleteResponses(ids); ids.forEach(function(id){fsDeleteDoc('responses',id);}); return r; };
  var _clearAllResponses = window.clearAllResponses;
  if(_clearAllResponses) window.clearAllResponses = function() { var a=JSON.parse(localStorage.getItem('sfft_responses')||'[]'); var r=_clearAllResponses(); a.forEach(function(x){fsDeleteDoc('responses',x.id);}); return r; };
  var _saveSettings = window.saveSettings;
  window.saveSettings = function(s) { var r = _saveSettings(s); var d=JSON.parse(localStorage.getItem('sfft_settings')||'{}'); fsSetDoc('settings','global',d); return r; };
  var _saveAttendanceRecords = window.saveAttendanceRecords;
  window.saveAttendanceRecords = function(recs) { var r = _saveAttendanceRecords(recs); var a=JSON.parse(localStorage.getItem('sfft_attendance')||'[]'); recs.forEach(function(rec){var s=a.find(function(x){return x.studentId===rec.studentId;}); if(s) fsSetDoc('attendance',s.studentId,s);}); return r; };
}

window.fbInit = function() {
  if (typeof initDB === 'function') initDB();
  patchDataFunctions();
  syncFromFirestoreInBackground();
};
window.startApp = function(cb) { window.fbInit(); if(typeof cb==='function') cb(); };

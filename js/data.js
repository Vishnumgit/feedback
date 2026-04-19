// ============================================================
// data.js — LocalStorage Data Layer
// ============================================================

const DB = {
  USERS: 'sfft_users',
  SUBJECTS: 'sfft_subjects',
  QUESTIONNAIRES: 'sfft_questionnaires',
  ENROLLMENTS: 'sfft_enrollments',
  RESPONSES: 'sfft_responses',
  ATTENDANCE: 'sfft_attendance',
  SETTINGS: 'sfft_settings',
};

const ATTENDANCE_THRESHOLD = 75; // students need >= this % to submit feedback

// ---- Helpers ------------------------------------------------
const get = (key) => JSON.parse(localStorage.getItem(key) || '[]');
const set = (key, val) => localStorage.setItem(key, JSON.stringify(val));
const getObj = (key) => JSON.parse(localStorage.getItem(key) || '{}');
const setObj = (key, val) => localStorage.setItem(key, JSON.stringify(val));


// ---- Password Hashing (SHA-256 via Web Crypto API) ----
async function hashPassword(password) {
  // Use Web Crypto API if available (HTTPS only), otherwise use JS fallback
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    var encoder = new TextEncoder();
    var data = encoder.encode(password);
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  // Fallback SHA-256 for HTTP (non-secure contexts)
  function sha256(str) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow, maxWord = mathPow(2, 32), lengthProperty = 'length';
    var i, j, result = '';
    var words = [], asciiBitLength = str[lengthProperty] * 8;
    var hash = [], k = [];
    var isComposite = {};
    for (var candidate = 2, primeCounter = 0; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    str += '\x80';
    while (str[lengthProperty] % 64 - 56) str += '\x00';
    for (i = 0; i < str[lengthProperty]; i++) {
      j = str.charCodeAt(i);
      if (j >> 8) return;
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength);
    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i]
          + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++)
      for (j = 3; j + 1; j--)
        result += ((hash[i] >> (j * 8)) & 255).toString(16).padStart(2, '0');
    return result;
  }
  return sha256(password);
}

// ---- Migration: Rename 'Demo Admin' -> 'Admin' in stored data ----
(function migrateAdminName() {
  try {
    var usersRaw = localStorage.getItem('sfft_users');
    if (usersRaw) {
      var updated = usersRaw.replace(/Demo Admin/g, 'Admin');
      if (updated !== usersRaw) {
        localStorage.setItem('sfft_users', updated);
        console.log('[Migration] Renamed Demo Admin -> Admin in stored users');
      }
    }
    // Also fix demo-prefixed keys
    var demoUsersRaw = localStorage.getItem('demo_sfft_users');
    if (demoUsersRaw) {
      var dUpdated = demoUsersRaw.replace(/Demo Admin/g, 'Admin');
      if (dUpdated !== demoUsersRaw) {
        localStorage.setItem('demo_sfft_users', dUpdated);
        console.log('[Migration] Renamed Demo Admin -> Admin in demo users');
      }
    }
    // Fix session too
    var sessionRaw = sessionStorage.getItem('sfft_session');
    if (sessionRaw) {
      var sUpdated = sessionRaw.replace(/Demo Admin/g, 'Admin');
      if (sUpdated !== sessionRaw) {
        sessionStorage.setItem('sfft_session', sUpdated);
        console.log('[Migration] Renamed Demo Admin -> Admin in session');
      }
    }
  } catch(e) { /* ignore */ }
})();

// ---- Init / Seed --------------------------------------------
function initDB() {
  if (localStorage.getItem('sfft_initialized')) return;

  // ===== DEMO DATA =====
  // Passwords: ***, ***, *** (SHA-256 hashed)
  const ADMIN_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
  const TEACHER_HASH = 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416';
  const STUDENT_HASH = '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b';

  // ----- Users: 1 Admin + 3 Teachers + 5 Students -----
  const users = [
    // Admin
    { id: 'u_admin', email: 'admin@college.edu', passwordHash: ADMIN_HASH, role: 'admin', name: 'Admin', department: 'Administration', active: true },
    // Teachers
    { id: 'u_t1', email: 'teacher1@college.edu', passwordHash: TEACHER_HASH, role: 'teacher', name: 'Sample Teacher 1', department: 'Science', subjectId: 'sub_math', active: true },
    { id: 'u_t2', email: 'teacher2@college.edu', passwordHash: TEACHER_HASH, role: 'teacher', name: 'Sample Teacher 2', department: 'Technology', subjectId: 'sub_cs', active: true },
    { id: 'u_t3', email: 'teacher3@college.edu', passwordHash: TEACHER_HASH, role: 'teacher', name: 'Sample Teacher 3', department: 'Science', subjectId: 'sub_phys', active: true },
    // Students
    { id: 'u_s1', email: 'student1@college.edu', passwordHash: STUDENT_HASH, role: 'student', name: 'Sample Student 1', department: 'Science', section: 'A', rollNo: 'CSE-101', active: true },
    { id: 'u_s2', email: 'student2@college.edu', passwordHash: STUDENT_HASH, role: 'student', name: 'Sample Student 2', department: 'Science', section: 'A', rollNo: 'CSE-102', active: true },
    { id: 'u_s3', email: 'student3@college.edu', passwordHash: STUDENT_HASH, role: 'student', name: 'Sample Student 3', department: 'Technology', section: 'B', rollNo: 'CSE-201', active: true },
    { id: 'u_s4', email: 'student4@college.edu', passwordHash: STUDENT_HASH, role: 'student', name: 'Sample Student 4', department: 'Science', section: 'A', rollNo: 'CSE-103', active: true },
    { id: 'u_s5', email: 'student5@college.edu', passwordHash: STUDENT_HASH, role: 'student', name: 'Sample Student 5', department: 'Technology', section: 'B', rollNo: 'CSE-202', active: true },
  ];
  set(DB.USERS, users);

  // ----- Subjects -----
  const subjects = [
    { id: 'sub_math', name: 'Mathematics', department: 'Science' },
    { id: 'sub_phys', name: 'Physics', department: 'Science' },
    { id: 'sub_eng', name: 'English', department: 'Humanities' },
    { id: 'sub_cs', name: 'Computer Science', department: 'Technology' },
    { id: 'sub_chem', name: 'Chemistry', department: 'Science' },
  ];
  set(DB.SUBJECTS, subjects);

  // ----- Questionnaires (keep original) -----
  const questionnaires = {
    sub_math: {
      sections: [
        { title: 'Teaching Methodology', questions: ['Explains mathematical concepts clearly', 'Uses step-by-step problem solving approach', 'Provides sufficient examples and practice problems', 'Connects topics to real-world applications', 'Paces lessons appropriately for understanding'] },
        { title: 'Communication Skills', questions: ['Communicates objectives clearly at start of class', 'Encourages student questions and participation', 'Responds to queries with clarity and patience', 'Uses board/projector effectively'] },
        { title: 'Subject Knowledge', questions: ['Demonstrates thorough mastery of mathematical content', 'Stays updated with curriculum and exam patterns', 'Handles unexpected or advanced questions confidently', 'Connects different topics within Mathematics'] },
        { title: 'Classroom Management', questions: ['Maintains a focused and disciplined class environment', 'Manages time effectively during lectures', 'Ensures all students are engaged'] },
        { title: 'Subject-Specific (Maths)', questions: ['Explains formula derivations clearly', 'Guides students through problem-solving strategies', 'Provides adequate practice for competitive exams'] },
      ]
    },
    sub_phys: {
      sections: [
        { title: 'Teaching Methodology', questions: ['Explains physics concepts with clarity', 'Integrates theory with practical demonstrations', 'Uses diagrams and visual aids effectively', 'Encourages inquiry-based learning', 'Maintains appropriate lecture pace'] },
        { title: 'Communication Skills', questions: ['Communicates learning objectives clearly', 'Encourages questions and class discussion', 'Explains complex topics in simple terms', 'Gives constructive feedback on student work'] },
        { title: 'Subject Knowledge', questions: ['Demonstrates deep knowledge of Physics', 'Links theoretical concepts to real-world phenomena', 'Handles advanced questions confidently', 'Keeps up with modern Physics developments'] },
        { title: 'Classroom Management', questions: ['Maintains discipline and focus', 'Manages classroom time efficiently', 'Keeps all students engaged'] },
        { title: 'Subject-Specific (Physics)', questions: ['Quality of lab demonstrations and experiments', 'Clarity in explaining laws and derivations', 'Bridges theory and practical application well'] },
      ]
    },
    sub_eng: {
      sections: [
        { title: 'Teaching Methodology', questions: ['Makes literature and language engaging', 'Uses creative teaching activities', 'Encourages reading and writing practice', 'Provides diverse learning materials', 'Adapts teaching to different skill levels'] },
        { title: 'Communication Skills', questions: ['Articulates ideas and instructions clearly', 'Encourages student expression and discussion', 'Provides useful feedback on written work', 'Models good spoken and written English'] },
        { title: 'Subject Knowledge', questions: ['Demonstrates strong command of English language', 'Has broad knowledge of literary works', 'Explains grammar rules accurately', 'Connects language to contemporary usage'] },
        { title: 'Classroom Management', questions: ['Creates a comfortable speaking environment', 'Manages time across reading/writing/speaking activities', 'Keeps class focused and active'] },
        { title: 'Subject-Specific (English)', questions: ['Effectiveness in teaching reading comprehension', 'Approach to grammar and vocabulary instruction', 'Support for essay writing and composition skills'] },
      ]
    },
    sub_cs: {
      sections: [
        { title: 'Teaching Methodology', questions: ['Explains programming concepts step by step', 'Live codes to illustrate concepts', 'Encourages hands-on coding practice', 'Links concepts to industry use-cases', 'Balances theory with practical labs'] },
        { title: 'Communication Skills', questions: ['Explains technical topics in an understandable way', 'Encourages coding questions and debugging discussion', 'Gives clear instructions for assignments/projects', 'Provides timely feedback on code submissions'] },
        { title: 'Subject Knowledge', questions: ['Has strong expertise in the subject area', 'Is aware of modern tools, languages and trends', 'Handles complex technical questions confidently', 'Relates curriculum to current industry practices'] },
        { title: 'Classroom Management', questions: ['Keeps lab sessions organized and productive', 'Manages time between lecture and coding practice', 'Ensures all students can follow along'] },
        { title: 'Subject-Specific (CS)', questions: ['Quality of code explanation and walkthroughs', 'Effectiveness of IDE/tool demonstrations', 'Guidance provided for debugging and problem-solving'] },
      ]
    },
    sub_chem: {
      sections: [
        { title: 'Teaching Methodology', questions: ['Explains chemical concepts clearly', 'Uses experiments/demonstrations effectively', 'Provides real-world context for reactions', 'Covers theory and practical equally', 'Paces lessons well'] },
        { title: 'Communication Skills', questions: ['Communicates learning goals clearly', 'Encourages questions from students', 'Explains equations and reactions in simple terms', 'Provides helpful feedback'] },
        { title: 'Subject Knowledge', questions: ['Shows strong mastery of Chemistry content', 'Handles advanced or unexpected questions', 'Connects different branches of Chemistry', 'Stays updated with curriculum'] },
        { title: 'Classroom Management', questions: ['Maintains safety and focus in lab settings', 'Manages class time effectively', 'Keeps students engaged'] },
        { title: 'Subject-Specific (Chemistry)', questions: ['Clarity in explaining chemical equations and mechanisms', 'Quality of lab demonstrations', 'Ability to link periodic table knowledge to real reactions'] },
      ]
    },
  };
  setObj(DB.QUESTIONNAIRES, questionnaires);

  // ----- Enrollments: Students assigned to Teachers/Subjects -----
  const enrollments = [];
  set(DB.ENROLLMENTS, enrollments);

  // ----- Attendance -----
  const attendance = [];
  set(DB.ATTENDANCE, attendance);

  // ----- Sample Feedback Responses -----
  const responses = [];
  set(DB.RESPONSES, responses);

  // ----- Settings -----
  setObj(DB.SETTINGS, { collegeDomain: 'college.edu', collegeName: 'XYZ College of Engineering', minThreshold: 3.5 });

  localStorage.setItem('sfft_initialized', '1');
}
// ---- Settings -----------------------------------------------
function getSettings() { return getObj(DB.SETTINGS); }
function saveSettings(s) { setObj(DB.SETTINGS, s); }

// Cross-device fix: Fetch settings from Firestore when localStorage is empty
async function fetchSettingsFromFirestore() {
  try {
    if (typeof db === 'undefined') return getSettings();
    var local = getSettings();
    if (local && local.collegeDomain && local.collegeDomain !== 'college.edu') return local;
    var snap = await db.collection('settings').doc('global').get();
    if (snap.exists) {
      var remote = snap.data();
      if (remote && remote.collegeDomain) {
        var merged = Object.assign({}, local, remote);
        setObj(DB.SETTINGS, merged);
        console.log('[Data] Settings synced from Firestore:', remote.collegeDomain);
        return merged;
      }
    }
    return local;
  } catch(e) {
    console.warn('[Data] Firestore settings fetch failed:', e.message);
    return getSettings();
  }
}

// ---- Users --------------------------------------------------
function getUsers() { return get(DB.USERS); }
function getUserByEmail(email) {
  if (!email) return null;
  var key = String(email).toLowerCase();
  return getUsers().find(function(u) { return (u.email || '').toLowerCase() === key; });
}
function getUserById(id) { return getUsers().find(u => u.id === id); }
function saveUser(user) {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx > -1) users[idx] = user; else users.push(user);
  set(DB.USERS, users);
}
function deleteUser(userId) {
  set(DB.USERS, getUsers().filter(u => u.id !== userId));
  // clean enrollments
  set(DB.ENROLLMENTS, get(DB.ENROLLMENTS).filter(e => e.studentId !== userId && e.teacherId !== userId));
}
async function addUser({ role, name, email, password, department, section, subjectId, rollNo }) {
  if (getUserByEmail(email)) throw new Error('Email already registered.');
  const id = 'u_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  const pwHash = await hashPassword(password);
  const user = { id, email, passwordHash: pwHash, role, name, department: department || '', section: section || '', subjectId: subjectId || null, rollNo: rollNo || '', active: true };
  saveUser(user);
  return user;
}
function getTeachers() { return getUsers().filter(u => u.role === 'teacher' && u.active); }
function getStudents() { return getUsers().filter(u => u.role === 'student' && u.active); }

// ---- Subjects -----------------------------------------------
function getSubjects() { return get(DB.SUBJECTS); }
function getSubjectById(id) { return getSubjects().find(s => s.id === id); }
function saveSubject(sub) {
  const subs = getSubjects();
  const idx = subs.findIndex(s => s.id === sub.id);
  if (idx > -1) subs[idx] = sub; else subs.push(sub);
  set(DB.SUBJECTS, subs);
}
function deleteSubject(id) { set(DB.SUBJECTS, getSubjects().filter(s => s.id !== id)); }
function addSubject({ name, department }) {
  const id = 'sub_' + Date.now();
  const sub = { id, name, department };
  saveSubject(sub);
  // init blank questionnaire
  const q = getObj(DB.QUESTIONNAIRES);
  q[id] = { sections: [{ title: 'Teaching Methodology', questions: ['Explains concepts clearly'] }, { title: 'Open Feedback', questions: [] }] };
  setObj(DB.QUESTIONNAIRES, q);
  return sub;
}

// ---- Questionnaires -----------------------------------------
function getQuestionnaire(subjectId) {
  const all = getObj(DB.QUESTIONNAIRES);
  return all[subjectId] || { sections: [] };
}
function saveQuestionnaire(subjectId, data) {
  const all = getObj(DB.QUESTIONNAIRES);
  all[subjectId] = data;
  setObj(DB.QUESTIONNAIRES, all);
}

// ---- Enrollments --------------------------------------------
function getEnrollments() { return get(DB.ENROLLMENTS); }
function getTeachersForStudent(studentId) {
  const enrollments = getEnrollments().filter(e => e.studentId === studentId);
  const result = [];
  enrollments.forEach(function(e) {
    const teacher = getUserById(e.teacherId);
    if (!teacher) return;
    const subjectIds = e.subjectIds || [];
    if (subjectIds.length === 0) {
      // Legacy enrollment without subjectIds
      const copy = Object.assign({}, teacher);
      copy._enrolledSubjectId = teacher.subjectId || null;
      result.push(copy);
    } else {
      subjectIds.forEach(function(subId) {
        const copy = Object.assign({}, teacher);
        copy._enrolledSubjectId = subId;
        result.push(copy);
      });
    }
  });
  return result;
}
function getStudentsForTeacher(teacherId) {
  const eList = getEnrollments().filter(e => e.teacherId === teacherId).map(e => e.studentId);
  return getStudents().filter(s => eList.includes(s.id));
}
function enroll(studentId, teacherId, subjectIds) {
  const enrollments = getEnrollments();
  subjectIds = subjectIds || [];

  // Find existing enrollment for this student-teacher pair
  const existing = enrollments.find(e => e.studentId === studentId && e.teacherId === teacherId);

  if (existing) {
    // Merge subjectIds - add new subjects to existing enrollment
    const existingSubjects = existing.subjectIds || [];
    const mergedSubjects = [...new Set([...existingSubjects, ...subjectIds])];
    existing.subjectIds = mergedSubjects;
    existing.enrolledAt = Date.now();
  } else {
    // Create new enrollment
    enrollments.push({ studentId, teacherId, subjectIds, enrolledAt: Date.now() });
  }
  set(DB.ENROLLMENTS, enrollments);
}
function unenroll(studentId, teacherId, subjectIds) {
  const enrollments = getEnrollments();

  if (!subjectIds || subjectIds.length === 0) {
    // Remove entire enrollment if no specific subjects provided
    set(DB.ENROLLMENTS, enrollments.filter(e => !(e.studentId === studentId && e.teacherId === teacherId)));
  } else {
    // Remove only the specified subjects from the enrollment
    const enrollment = enrollments.find(e => e.studentId === studentId && e.teacherId === teacherId);
    if (enrollment) {
      const existingSubjects = enrollment.subjectIds || [];
      const remainingSubjects = existingSubjects.filter(subId => !subjectIds.includes(subId));

      if (remainingSubjects.length === 0) {
        // No subjects left, remove entire enrollment
        set(DB.ENROLLMENTS, enrollments.filter(e => !(e.studentId === studentId && e.teacherId === teacherId)));
      } else {
        // Update enrollment with remaining subjects
        enrollment.subjectIds = remainingSubjects;
        set(DB.ENROLLMENTS, enrollments);
      }
    }
  }
}

// ---- Attendance ------------------------------------------
// attendance record: { studentId, percentage, section, uploadedAt }
function getAttendance() { return get(DB.ATTENDANCE); }
function getStudentAttendance(studentId) {
  return getAttendance().find(a => a.studentId === studentId) || null;
}
function canSubmitFeedback(studentId) {
  const rec = getStudentAttendance(studentId);
  if (!rec) return true; // no record uploaded = allow submission by default
  return rec.percentage >= ATTENDANCE_THRESHOLD;
}
function saveAttendanceRecords(records) {
  // records: [{ studentId, percentage, section }]
  const existing = getAttendance();
  records.forEach(rec => {
    const idx = existing.findIndex(a => a.studentId === rec.studentId);
    const entry = { ...rec, uploadedAt: Date.now() };
    if (idx > -1) existing[idx] = entry; else existing.push(entry);
  });
  set(DB.ATTENDANCE, existing);
}
function clearAttendanceForSection(section) {
  set(DB.ATTENDANCE, getAttendance().filter(a => a.section !== section));
}


function getResponses() { return get(DB.RESPONSES); }
function getResponsesForTeacher(teacherId) { return getResponses().filter(r => r.teacherId === teacherId); }
function hasSubmitted(studentId, teacherId, subjectId) {
  return getResponses().some(function(r) {
    if (r.studentId !== studentId || r.teacherId !== teacherId) return false;
    if (subjectId) return r.subjectId === subjectId;
    return true;
  });
}
function saveResponse({ teacherId, studentId, subjectId, anonymous, scores, comments }) {
  const all = getResponses();
  // Prevent duplicate per teacher+subject
  const idx = all.findIndex(r => r.studentId === studentId && r.teacherId === teacherId && r.subjectId === subjectId);
  const rec = {
    id: 'r_' + Date.now(),
    teacherId, studentId, subjectId, anonymous,
    scores, // { sectionTitle: [ratings...] }
    comments,
    submittedAt: Date.now()
  };
  if (idx > -1) all[idx] = rec; else all.push(rec);
  set(DB.RESPONSES, all);
}

function deleteResponse(responseId) {
  set(DB.RESPONSES, getResponses().filter(r => r.id !== responseId));
}
function deleteResponses(responseIds) {
  const idSet = new Set(responseIds);
  set(DB.RESPONSES, getResponses().filter(r => !idSet.has(r.id)));
}
function clearAllResponses() {
  set(DB.RESPONSES, []);
}

// ---- Analytics Helpers --------------------------------------
function getTeacherStats(teacherId) {
  const responses = getResponsesForTeacher(teacherId);
  if (!responses.length) return null;
  const sectionTotals = {};
  const sectionCounts = {};
  responses.forEach(r => {
    Object.entries(r.scores || {}).forEach(([section, ratings]) => {
      if (!sectionTotals[section]) { sectionTotals[section] = 0; sectionCounts[section] = 0; }
      ratings.forEach(v => { sectionTotals[section] += v; sectionCounts[section]++; });
    });
  });
  const sectionAverages = {};
  Object.keys(sectionTotals).forEach(k => {
    sectionAverages[k] = +(sectionTotals[k] / sectionCounts[k]).toFixed(2);
  });
  const allRatings = responses.flatMap(r => Object.values(r.scores || {}).flat());
  const overallAvg = allRatings.length ? +(allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2) : 0;
  // Rating distribution
  const dist = [0, 0, 0, 0, 0];
  allRatings.forEach(v => { if (v >= 1 && v <= 5) dist[v - 1]++; });
  // Trend (by week buckets)
  const trend = {};
  responses.forEach(r => {
    const d = new Date(r.submittedAt);
    const week = `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`;
    if (!trend[week]) trend[week] = [];
    trend[week].push(...Object.values(r.scores || {}).flat());
  });
  const trendData = Object.entries(trend).sort().map(([label, vals]) => ({
    label, avg: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
  }));
  return { sectionAverages, overallAvg, distribution: dist, totalResponses: responses.length, trendData };
}

function getInstitutionStats() {
  const teachers = getTeachers();
  return teachers.map(t => {
    const stats = getTeacherStats(t.id);
    const sub = getSubjectById(t.subjectId);
    return { teacher: t, subject: sub, stats };
  }).filter(x => x.stats);
}

// ---- Utility ------------------------------------------------
function generateId() { return 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7); }
function exportResponsesCSV() {
  const responses = getResponses();
  const rows = [['ID', 'Teacher', 'Student', 'Subject', 'Anonymous', 'Overall Avg', 'Comments', 'Date']];
  responses.forEach(r => {
    const t = getUserById(r.teacherId);
    const s = getUserById(r.studentId);
    const sub = getSubjectById(r.subjectId);
    const allRatings = Object.values(r.scores || {}).flat();
    const avg = allRatings.length ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(2) : 'N/A';
    rows.push([
      r.id,
      t ? t.name : 'Unknown',
      r.anonymous ? 'Anonymous' : (s ? s.name : 'Unknown'),
      sub ? sub.name : 'Unknown',
      r.anonymous ? 'Yes' : 'No',
      avg,
      (r.comments || '').replace(/,/g, ';'),
      new Date(r.submittedAt).toLocaleDateString()
    ]);
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'feedback_export.csv';
  a.click();
}

// ============================================================
// demo-isolator.js — Demo Mode Data Isolation
// ============================================================
// When a demo session is active (sessionStorage sfft_session has isDemo=true),
// this script intercepts localStorage so that all sfft_* keys are transparently
// redirected to demo_sfft_* keys. This keeps demo data completely separate
// from real production data and prevents any cross-contamination.
//
// MUST be loaded BEFORE data.js, auth.js, and firebase-sync.js on every page
// that a demo user can reach (dashboards, feedback-form, etc.).
// ============================================================

(function() {
  'use strict';

  // --- Check if current session is a demo session ---
  function isDemoSession() {
    try {
      var session = JSON.parse(sessionStorage.getItem('sfft_session') || 'null');
      return session && session.isDemo === true;
    } catch(e) {
      return false;
    }
  }

  // Only intercept if we are in demo mode
  if (!isDemoSession()) return;

  console.log('[Demo] Demo mode detected — isolating localStorage');

  // Keys that should be redirected in demo mode
  var DEMO_PREFIX = 'demo_';
  var ISOLATED_PREFIXES = ['sfft_', 'sf_'];

  // Keys that should NOT be redirected (session-level, not data-level)
  var EXEMPT_KEYS = ['sfft_session'];

  function shouldRedirect(key) {
    if (!key) return false;
    // Don't redirect exempt keys
    for (var i = 0; i < EXEMPT_KEYS.length; i++) {
      if (key === EXEMPT_KEYS[i]) return false;
    }
    // Redirect keys that match isolated prefixes
    for (var j = 0; j < ISOLATED_PREFIXES.length; j++) {
      if (key.indexOf(ISOLATED_PREFIXES[j]) === 0) return true;
    }
    return false;
  }

  function demoKey(key) {
    return DEMO_PREFIX + key;
  }

  // --- Intercept localStorage methods ---
  var _getItem = Storage.prototype.getItem;
  var _setItem = Storage.prototype.setItem;
  var _removeItem = Storage.prototype.removeItem;

  Storage.prototype.getItem = function(key) {
    if (this === localStorage && shouldRedirect(key)) {
      return _getItem.call(this, demoKey(key));
    }
    return _getItem.call(this, key);
  };

  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && shouldRedirect(key)) {
      return _setItem.call(this, demoKey(key), value);
    }
    return _setItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function(key) {
    if (this === localStorage && shouldRedirect(key)) {
      return _removeItem.call(this, demoKey(key));
    }
    return _removeItem.call(this, key);
  };

  // --- Seed demo data on first visit ---
  // Uses the original (non-intercepted) localStorage to check the demo seed flag,
  // but writes demo data through the intercepted path (which adds the demo_ prefix).
  var DEMO_SEEDED_KEY = 'demo_sfft_seeded';
  if (!_getItem.call(localStorage, DEMO_SEEDED_KEY)) {
    seedDemoData();
    _setItem.call(localStorage, DEMO_SEEDED_KEY, '1');
  }

  function seedDemoData() {
    console.log('[Demo] Seeding isolated demo data');

    // --- Users ---
    var users = [
      { id: 'demo_admin', email: 'admin@demo.edu', passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', role: 'admin', name: 'Demo Admin', department: 'Administration', active: true },
      { id: 'demo_t1', email: 'singh@demo.edu', passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416', role: 'teacher', name: 'Prof. Demo Singh', department: 'CSE', subjectId: 'demo_sub1', active: true },
      { id: 'demo_t2', email: 'patel@demo.edu', passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416', role: 'teacher', name: 'Dr. Demo Patel', department: 'ECE', subjectId: 'demo_sub3', active: true },
      { id: 'demo_s1', email: 'rahul@demo.edu', passwordHash: '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b', role: 'student', name: 'Rahul Kumar', department: 'CSE', section: 'CSE-1', rollNo: 'D001', active: true },
      { id: 'demo_s2', email: 'priya@demo.edu', passwordHash: '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b', role: 'student', name: 'Priya Sharma', department: 'CSE', section: 'CSE-2', rollNo: 'D002', active: true },
      { id: 'demo_s3', email: 'amit@demo.edu', passwordHash: '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b', role: 'student', name: 'Amit Reddy', department: 'ECE', section: 'ECE-1', rollNo: 'D003', active: true },
      { id: 'demo_student', email: 'demo@student.edu', passwordHash: '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b', role: 'student', name: 'Demo Student', department: 'CSE', section: 'CSE-4', rollNo: 'DEMO001', active: true },
      { id: 'demo_teacher', email: 'demo@teacher.edu', passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416', role: 'teacher', name: 'Demo Teacher', department: 'CSE', subjectId: 'demo_sub1', active: true }
    ];

    // --- Subjects ---
    var subjects = [
      { id: 'demo_sub1', name: 'Data Structures', department: 'CSE' },
      { id: 'demo_sub2', name: 'Web Development', department: 'CSE' },
      { id: 'demo_sub3', name: 'Digital Electronics', department: 'ECE' }
    ];

    // --- Questionnaires ---
    var questionnaires = {
      demo_sub1: {
        sections: [
          { title: 'Teaching Methodology', questions: ['Explains data structure concepts clearly', 'Uses step-by-step problem solving approach', 'Provides sufficient coding examples', 'Connects topics to real-world applications', 'Paces lessons appropriately'] },
          { title: 'Communication Skills', questions: ['Communicates objectives clearly', 'Encourages student questions', 'Responds with clarity and patience', 'Uses board/projector effectively'] },
          { title: 'Subject Knowledge', questions: ['Demonstrates thorough mastery of DSA', 'Handles advanced questions confidently', 'Connects different data structures'] }
        ]
      },
      demo_sub2: {
        sections: [
          { title: 'Teaching Methodology', questions: ['Explains web concepts step by step', 'Live codes to illustrate concepts', 'Encourages hands-on practice', 'Links concepts to industry use-cases'] },
          { title: 'Communication Skills', questions: ['Explains technical topics understandably', 'Gives clear instructions for projects', 'Provides timely feedback'] },
          { title: 'Subject Knowledge', questions: ['Has strong expertise in web technologies', 'Is aware of modern frameworks and trends', 'Handles complex questions confidently'] }
        ]
      },
      demo_sub3: {
        sections: [
          { title: 'Teaching Methodology', questions: ['Explains digital electronics clearly', 'Integrates theory with practical demos', 'Uses diagrams and visual aids effectively', 'Encourages inquiry-based learning'] },
          { title: 'Communication Skills', questions: ['Communicates learning objectives clearly', 'Encourages questions and discussion', 'Explains complex topics simply'] },
          { title: 'Subject Knowledge', questions: ['Demonstrates deep knowledge of electronics', 'Links theory to real-world applications', 'Handles advanced questions confidently'] }
        ]
      }
    };

    // --- Enrollments ---
    var enrollments = [
      { studentId: 'demo_s1', teacherId: 'demo_t1', subjectIds: ['demo_sub1', 'demo_sub2'], enrolledAt: Date.now() - 86400000 },
      { studentId: 'demo_s2', teacherId: 'demo_t1', subjectIds: ['demo_sub1'], enrolledAt: Date.now() - 86400000 },
      { studentId: 'demo_s3', teacherId: 'demo_t2', subjectIds: ['demo_sub3'], enrolledAt: Date.now() - 86400000 },
      { studentId: 'demo_student', teacherId: 'demo_t1', subjectIds: ['demo_sub1', 'demo_sub2'], enrolledAt: Date.now() - 86400000 },
      { studentId: 'demo_student', teacherId: 'demo_t2', subjectIds: ['demo_sub3'], enrolledAt: Date.now() - 86400000 }
    ];

    // --- Attendance ---
    var attendance = [
      { studentId: 'demo_s1', percentage: 88, section: 'CSE-1', uploadedAt: Date.now() - 43200000 },
      { studentId: 'demo_s2', percentage: 92, section: 'CSE-2', uploadedAt: Date.now() - 43200000 },
      { studentId: 'demo_s3', percentage: 78, section: 'ECE-1', uploadedAt: Date.now() - 43200000 },
      { studentId: 'demo_student', percentage: 85, section: 'CSE-4', uploadedAt: Date.now() - 43200000 }
    ];

    // --- Sample Feedback Responses ---
    var responses = [
      {
        id: 'r_demo_1', teacherId: 'demo_t1', studentId: 'demo_s1', subjectId: 'demo_sub1', anonymous: true,
        scores: { 'Teaching Methodology': [5, 4, 5, 4, 5], 'Communication Skills': [4, 5, 4, 5], 'Subject Knowledge': [5, 5, 4] },
        comments: 'Excellent teaching! Very clear explanations.', submittedAt: Date.now() - 172800000
      },
      {
        id: 'r_demo_2', teacherId: 'demo_t1', studentId: 'demo_s2', subjectId: 'demo_sub1', anonymous: false,
        scores: { 'Teaching Methodology': [4, 4, 3, 4, 4], 'Communication Skills': [4, 3, 4, 4], 'Subject Knowledge': [4, 4, 5] },
        comments: 'Good overall, could use more practice problems.', submittedAt: Date.now() - 86400000
      },
      {
        id: 'r_demo_3', teacherId: 'demo_t2', studentId: 'demo_s3', subjectId: 'demo_sub3', anonymous: true,
        scores: { 'Teaching Methodology': [5, 5, 4, 5], 'Communication Skills': [5, 4, 5], 'Subject Knowledge': [5, 5, 4] },
        comments: 'Great practical demonstrations!', submittedAt: Date.now() - 259200000
      }
    ];

    // --- Settings ---
    var settings = { collegeDomain: 'demo.edu', collegeName: 'Demo College of Engineering', minThreshold: 3.5 };

    // Write through the intercepted localStorage (auto-prefixed with demo_)
    localStorage.setItem('sfft_users', JSON.stringify(users));
    localStorage.setItem('sfft_subjects', JSON.stringify(subjects));
    localStorage.setItem('sfft_questionnaires', JSON.stringify(questionnaires));
    localStorage.setItem('sfft_enrollments', JSON.stringify(enrollments));
    localStorage.setItem('sfft_attendance', JSON.stringify(attendance));
    localStorage.setItem('sfft_responses', JSON.stringify(responses));
    localStorage.setItem('sfft_settings', JSON.stringify(settings));
    localStorage.setItem('sfft_initialized', '1');
  }

  // --- Mark window as demo mode for other scripts to check ---
  window.__DEMO_MODE__ = true;

})();

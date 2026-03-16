/**
 * Notifications Manager
 * Centralized utility for vibration, sound, badge counters, and enhanced notifications.
 */
(function(global) {
  'use strict';

  // ── Vibration Patterns ────────────────────────────────────────────────────
  var VIBRATION = {
    short:      [100],
    double:     [100, 80, 100],
    assignment: [150, 100, 150, 100, 150],
    urgent:     [200, 100, 200, 100, 200, 100, 200],
    gentle:     [60]
  };

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(pattern || VIBRATION.short);
      }
    } catch (e) { /* vibration not supported */ }
  }

  // ── Web Audio Notification Sound ─────────────────────────────────────────
  var _audioCtx = null;

  function _getAudioContext() {
    if (!_audioCtx) {
      try {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { /* audio context not supported */ }
    }
    return _audioCtx;
  }

  // ── Audio frequency constants (Hz) ───────────────────────────────────────
  var FREQ = {
    C5: 523.25,
    E5: 659.25,
    G5: 783.99,
    A5: 880.00
  };

  /**
   * Play a short synthesised notification chime.
   * @param {'assignment'|'general'|'urgent'} [type='general']
   */
  function playSound(type) {
    var ctx = _getAudioContext();
    if (!ctx) return;

    // Resume context if suspended (browsers require user-gesture first)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function() {});
    }

    var frequencies;
    switch (type) {
      case 'assignment':
        frequencies = [FREQ.C5, FREQ.E5, FREQ.G5]; // C5-E5-G5 (major chord)
        break;
      case 'urgent':
        frequencies = [FREQ.A5, FREQ.A5, FREQ.A5];
        break;
      default:
        frequencies = [FREQ.C5, FREQ.G5]; // C5-G5
    }

    var startTime = ctx.currentTime;
    frequencies.forEach(function(freq, i) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = freq;

      var t = startTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  // ── Badge Counter ─────────────────────────────────────────────────────────
  var _sessionId = null;

  function _getSessionId() {
    if (_sessionId) return _sessionId;
    try {
      var s = window.session;
      _sessionId = (s && (s.id || s.userId)) || 'default';
    } catch (e) {
      _sessionId = 'default';
    }
    return _sessionId;
  }

  function getUnreadCount() {
    var notifs = [];
    try { notifs = JSON.parse(localStorage.getItem('sf_notifications') || '[]'); } catch (e) {}
    var sid = _getSessionId();
    var readIds = [];
    try { readIds = JSON.parse(localStorage.getItem('sf_notif_read_' + sid) || '[]'); } catch (e) {}
    return notifs.filter(function(n) { return readIds.indexOf(n.id) === -1; }).length;
  }

  function updateBadge() {
    var count = getUnreadCount();
    var badge = document.getElementById('notifBadge');
    if (!badge) return;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = count > 0 ? '' : 'none';
    if (count > 0) {
      badge.classList.add('notif-badge-pulse');
    } else {
      badge.classList.remove('notif-badge-pulse');
    }
  }

  function incrementBadge() {
    updateBadge();
  }

  // ── Enhanced Browser Notification ─────────────────────────────────────────
  /**
   * Show an enhanced browser Notification (foreground only – while page is open).
   * @param {string} title
   * @param {string} body
   * @param {Object} [options]
   * @param {'assignment'|'general'|'urgent'} [options.type='general']
   */
  function showBrowserNotification(title, body, options) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var type = (options && options.type) || 'general';
    var iconMap = {
      assignment: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎓</text></svg>',
      urgent:     'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚠️</text></svg>',
      general:    'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📢</text></svg>'
    };
    var notifOpts = {
      body:              body,
      icon:              iconMap[type] || iconMap.general,
      badge:             'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔔</text></svg>',
      requireInteraction: type === 'assignment' || type === 'urgent',
      tag:               options && options.tag,
      data:              options && options.data
    };
    try {
      var n = new Notification(title, notifOpts);
      n.onclick = function() {
        window.focus();
        if (type === 'assignment' && typeof showSection === 'function') {
          showSection('notifications');
        }
        n.close();
      };
    } catch (e) { console.warn('[Notifications] Browser notification failed:', e.message); }
  }

  // ── All-in-one helper ─────────────────────────────────────────────────────
  /**
   * Handle an incoming notification: vibrate, play sound, show browser alert, update badge.
   * @param {string} title
   * @param {string} body
   * @param {'assignment'|'general'|'urgent'} [type='general']
   * @param {Object} [extra] - additional options forwarded to showBrowserNotification
   */
  function handleIncoming(title, body, type, extra) {
    type = type || 'general';

    // Vibration
    var vibratePattern = VIBRATION[type] || VIBRATION.short;
    vibrate(vibratePattern);

    // Sound
    playSound(type);

    // Badge
    incrementBadge();

    // Browser notification (works even if app is in foreground)
    showBrowserNotification(title, body, Object.assign({ type: type }, extra || {}));
  }

  // ── Public API ────────────────────────────────────────────────────────────
  global.NotificationsManager = {
    vibrate:                vibrate,
    VIBRATION:              VIBRATION,
    playSound:              playSound,
    getUnreadCount:         getUnreadCount,
    updateBadge:            updateBadge,
    showBrowserNotification: showBrowserNotification,
    handleIncoming:         handleIncoming
  };

}(window));

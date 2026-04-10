// ============================================================
// env-loader.js — Environment Variable Loader
// ============================================================
// Synchronously loads environment variables from a root .env file
// and exposes them as window.ENV for use by firebase-config.js.
//
// NOTE: This approach keeps credentials out of version control
// (git history). The .env file is git-ignored. Credentials are
// still transmitted to the browser at runtime — secure your
// Firebase project with Security Rules and App Check.
//
// Usage: Place this <script> tag BEFORE the Firebase SDK and
//        js/firebase-config.js in every HTML page.
//
// Local development:
//   1. Copy .env.example to .env
//   2. Fill in your Firebase credentials
//   3. .env is git-ignored — credentials stay off GitHub
// ============================================================
(function () {
  window.ENV = {};
  try {
    var xhr = new XMLHttpRequest();
    // Synchronous request (false) so window.ENV is fully populated
    // before firebase-config.js runs in the next <script> tag.
    xhr.open('GET', '.env', false);
    xhr.send(null);
    if (xhr.status === 200) {
      xhr.responseText.split('\n').forEach(function (line) {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        var idx = line.indexOf('=');
        if (idx <= 0) return;
        var key = line.substring(0, idx).trim();
        var val = line.substring(idx + 1).trim();
        // Strip surrounding quotes: "value" or 'value'
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        window.ENV[key] = val;
      });
      console.log('[Env] Environment variables loaded from .env');
    }
  } catch (e) {
    console.warn('[Env] Could not load .env file:', e.message);
  }
})();

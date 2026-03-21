// =======================================================
// firebase-rest.js — Firestore REST API (replaces SDK connections)
// =======================================================
// All Firestore operations use stateless HTTP requests.
// Zero persistent WebSocket connections held.
// =======================================================

var FirestoreREST = (function() {
  'use strict';

  var PROJECT_ID = 'student-feedback-form-489916';
  var API_KEY = 'AIzaSyC9R2FKE9gwinvVocs92EtPjoFHG2TfDWM';
  var BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';

  // ─ Helpers: Convert Firestore REST format ↔ plain JS objects ───────

  function toFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'string') return { stringValue: val };
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return { integerValue: String(val) };
      return { doubleValue: val };
    }
    if (typeof val === 'boolean') return { booleanValue: val };
    if (Array.isArray(val)) {
      return { arrayValue: { values: val.map(toFirestoreValue) } };
    }
    if (typeof val === 'object') {
      var fields = {};
      Object.keys(val).forEach(function(k) {
        fields[k] = toFirestoreValue(val[k]);
      });
      return { mapValue: { fields: fields } };
    }
    return { stringValue: String(val) };
  }

  function fromFirestoreValue(fv) {
    if (!fv) return null;
    if ('stringValue' in fv) return fv.stringValue;
    if ('integerValue' in fv) return parseInt(fv.integerValue, 10);
    if ('doubleValue' in fv) return fv.doubleValue;
    if ('booleanValue' in fv) return fv.booleanValue;
    if ('nullValue' in fv) return null;
    if ('arrayValue' in fv) {
      return (fv.arrayValue.values || []).map(fromFirestoreValue);
    }
    if ('mapValue' in fv) {
      return fromFirestoreFields(fv.mapValue.fields || {});
    }
    if ('timestampValue' in fv) return fv.timestampValue;
    return null;
  }

  function fromFirestoreFields(fields) {
    var obj = {};
    Object.keys(fields || {}).forEach(function(k) {
      obj[k] = fromFirestoreValue(fields[k]);
    });
    return obj;
  }

  function toFirestoreFields(obj) {
    var fields = {};
    Object.keys(obj).forEach(function(k) {
      if (obj[k] !== undefined) {
        fields[k] = toFirestoreValue(obj[k]);
      }
    });
    return fields;
  }

  // ─ Core REST Operations ──────────────────────────────────

  // GET a single document
  function getDoc(collection, docId) {
    var url = BASE + '/' + collection + '/' + encodeURIComponent(docId) + '?key=' + API_KEY;
    return fetch(url)
      .then(function(res) {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('REST GET failed: ' + res.status);
        return res.json();
      })
      .then(function(doc) {
        if (!doc || !doc.fields) return null;
        return fromFirestoreFields(doc.fields);
      });
  }

  // GET all documents in a collection
  function getCollection(collection) {
    var url = BASE + '/' + collection + '?key=' + API_KEY + '&pageSize=1000';
    return fetch(url)
      .then(function(res) {
        if (!res.ok) throw new Error('REST LIST failed: ' + res.status);
        return res.json();
      })
      .then(function(data) {
        if (!data.documents) return [];
        return data.documents.map(function(doc) {
          return fromFirestoreFields(doc.fields);
        });
      });
  }

  // SET (create/overwrite) a document
  function setDoc(collection, docId, data) {
    var url = BASE + '/' + collection + '/' + encodeURIComponent(docId) + '?key=' + API_KEY;
    var fieldPaths = Object.keys(data).map(function(k) {
      return 'updateMask.fieldPaths=' + encodeURIComponent(k);
    }).join('&');
    if (fieldPaths) url += '&' + fieldPaths;

    return fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFirestoreFields(data) })
    }).then(function(res) {
      if (!res.ok) throw new Error('REST SET failed: ' + res.status);
      return res.json();
    });
  }

  // DELETE a document
  function deleteDoc(collection, docId) {
    var url = BASE + '/' + collection + '/' + encodeURIComponent(docId) + '?key=' + API_KEY;
    return fetch(url, { method: 'DELETE' })
      .then(function(res) {
        if (!res.ok && res.status !== 404) throw new Error('REST DELETE failed: ' + res.status);
        return true;
      });
  }

  // ─ Batch Operations ─────────────────────────────────

  function batchGetCollections(collections) {
    var promises = collections.map(function(c) {
      return getCollection(c).then(function(docs) {
        return { collection: c, docs: docs };
      }).catch(function(e) {
        console.warn('[REST] Failed to fetch ' + c + ':', e.message);
        return { collection: c, docs: [] };
      });
    });
    return Promise.all(promises);
  }

  // ─ Public API ─────────────────────────────────────────

  return {
    getDoc: getDoc,
    getCollection: getCollection,
    setDoc: setDoc,
    deleteDoc: deleteDoc,
    batchGetCollections: batchGetCollections,
    toFirestoreFields: toFirestoreFields,
    fromFirestoreFields: fromFirestoreFields,
    PROJECT_ID: PROJECT_ID
  };

})();
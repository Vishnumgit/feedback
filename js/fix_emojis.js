
const fs = require('fs');
const filePath = 'D:/project/student-feedback-form/admin-dashboard.html';

let content = fs.readFileSync(filePath, 'utf8');

// U+FFFD is the replacement character. We fix them by context (string matching).
// Listed from most-specific to least-specific to avoid partial-match conflicts.

const R = '\uFFFD'; // shorthand

const fixes = [
  // ── Inline JS template literals ──────────────────────────────────────────

  // Subject icon 📚  "°Y"s " -> "&#128218; " (books)
  [`${R}Y"s `, `&#128218; `],

  // Department icon 🏢  "°Y°> " -> "&#127962; " (office building)
  [`${R}Y\u00B0> `, `&#127962; `],   // tries with middle-dot variant
  [`${R}Y°> `,     `&#127962; `],

  // Section icon 🏷️  "°Y"> " -> "&#127991;&#65039; " (label)
  [`${R}Y"> `,     `&#127991; `],

  // Section "°Y">" -> 🏷️
  [`${R}Y"\u003e`, `&#127991;`],     // with HTML-encoded >

  // Responses badge 💬  "°Y"° " -> "&#128172; " (speech bubble)
  [`${R}Y"\u00B0 `, `&#128172; `],
  [`${R}Y"° `,      `&#128172; `],

  // Radar / chart icon 🎯  "°Y"° CATEGORY" -> "&#127919; CATEGORY"
  [`${R}Y"\u00B0 CATEGORY`, `&#127919; CATEGORY`],
  [`${R}Y"° CATEGORY`,      `&#127919; CATEGORY`],

  // Bar chart icon 📊  "°Y"S CATEGORY AVERAGES"
  [`${R}Y"S CATEGORY`, `&#128202; CATEGORY`],

  // Check / on-track  "°o. " -> "✔ "
  [`${R}o. `,  `&#10004; `],
  [`${R}o.`,   `&#10004;`],

  // Warning / skip / error  "°s⚙️" -> "⚠️"  (already has FE0F from prior pass)
  [`${R}s&#9881;&#65039;`, `&#9888;&#65039;`],  // if ⚙️ was already entity'd
  [`${R}s⚙️`,  `&#9888;&#65039;`],
  [`${R}s️`,   `&#9888;&#65039;`],              // if FE0F survived as is

  // Error icon 🚫  "°O " -> "&#128683; "
  [`${R}O `,   `&#128683; `],
  [`${R}O'`,   `&#128683;'`],

  // Empty state icon 📋  "°Y"S" (inside empty-icon div) -> 📋
  [`${R}Y"S`,  `&#128203;`],

  // Password min-length  "°?°6" -> "≥6"
  [`${R}?\u00B06`, `&#8805;6`],
  [`${R}?°6`,      `&#8805;6`],

  // Students enrolled icon 👤  "°Y'°" 
  [`${R}Y'\u00B0`,  `&#128100;`],
  [`${R}Y'°`,       `&#128100;`],

  // Dashboard title dash  "°?"" -> "—"  (em dash variant)
  [`${R}?"`,   `&mdash;`],

  // Generic remaining  \uFFFD alone (e.g. leftover in comments/titles) -> remove
  // Only if surrounded by ? (e.g. "°?\"" patterns not yet matched)
  [`${R}?\\"`, `&mdash;`],
];

let totalFixed = 0;
for (const [from, to] of fixes) {
  let count = 0;
  while (content.includes(from)) {
    content = content.replace(from, to);
    count++;
  }
  if (count > 0) {
    console.log(`  [x${count}] ${JSON.stringify(from)} -> ${to}`);
    totalFixed += count;
  }
}

// Final sweep: remove any remaining lone \uFFFD (truly unrecoverable, better than showing □)
const remainingCount = (content.match(/\uFFFD/g) || []).length;
if (remainingCount > 0) {
  content = content.replace(/\uFFFD/g, '');
  console.log(`  Removed ${remainingCount} remaining U+FFFD chars`);
  totalFixed += remainingCount;
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone! Fixed ${totalFixed} issues total.`);

// Quick sanity check
const check = fs.readFileSync(filePath, 'utf8');
const bad = (check.match(/\uFFFD/g) || []).length;
console.log(`Remaining replacement chars in file: ${bad}`);

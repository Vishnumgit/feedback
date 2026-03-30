<div align="center">

# 🎓 Student Feedback System

### A Modern, Multi-Role Feedback Collection & Analytics Platform for Educational Institutions

[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)
[![EmailJS](https://img.shields.io/badge/EmailJS-FF6C37?style=for-the-badge&logo=maildotru&logoColor=white)](https://www.emailjs.com/)

<br/>

<img src="https://img.shields.io/badge/Lines_of_Code-5,434-blueviolet?style=flat-square" />
<img src="https://img.shields.io/badge/Files-16-blue?style=flat-square" />
<img src="https://img.shields.io/badge/Roles-3_(Admin%2C_Teacher%2C_Student)-green?style=flat-square" />
<img src="https://img.shields.io/badge/Database-Firestore_+_localStorage-orange?style=flat-square" />
<img src="https://img.shields.io/badge/Framework-None_(Vanilla_JS)-lightgrey?style=flat-square" />

---

> 🏫 A transparent, anonymous, and structured system for collecting student feedback to enhance teaching quality and professional development.

</div>

---

## ✨ Key Highlights

| Feature | Description |
|---------|-------------|
| 🌙 **Dark Theme UI** | Beautiful dark glassmorphism design with purple accent theme |
| 🔐 **3 Role-Based Portals** | Separate dashboards for Admin, Teacher, and Student |
| 📊 **Rich Analytics** | Radar, Bar, Doughnut, and Trend charts powered by Chart.js |
| 📄 **Report Generator** | Downloadable HTML reports with SVG charts — print as PDF |
| 🔥 **Firebase Cloud Sync** | Offline-first with automatic Firestore background sync |
| 📱 **Responsive Design** | Works on desktop, tablet, and mobile screens |
| 🔑 **Password Reset** | Cloud Functions–backed forgot-password flow — EmailJS sends reset links, no unauthenticated Firestore access |
| 🚀 **Zero Dependencies** | No frameworks, no build step — just open `index.html` |
| 🔒 **SHA-256 Password Hashing** | Secure credential storage using Web Crypto API with legacy migration support |
| ⚡ **Performance Optimized** | Non-blocking login writes and 5-min sync cache reduce Firestore reads |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    🌐 Landing Page                       │
│              (Student / Teacher / Admin)                 │
└──────────┬──────────────┬──────────────┬────────────────┘
           │              │              │
    ┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
    │  🎓 Student │ │ 👨‍🏫 Teacher│ │  🔑 Admin  │
    │   Portal    │ │  Portal  │ │   Panel    │
    └──────┬──────┘ └────┬─────┘ └─────┬──────┘
           │              │              │
    ┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
    │  📝 Submit  │ │ 📊 View  │ │ 👥 Manage  │
    │  Feedback   │ │ Analytics│ │ Everything │
    └──────┬──────┘ └────┬─────┘ └─────┬──────┘
           │              │              │
           └──────────────┼──────────────┘
                          │
              ┌───────────▼───────────┐
              │    🗄️ Data Layer       │
              │  localStorage (fast)  │
              │    ⇅ background sync  │
              │  🔥 Firebase Firestore │
              └───────────────────────┘
```

---

## 🔑 Role-Based Features

### 🔐 Admin Panel — *7 Powerful Tabs*

| Tab | Features |
|-----|----------|
| 👥 **User Management** | Create/edit/delete users, bulk CSV import with column normalization, batch delete with Firestore cleanup |
| 📚 **Subjects & Questionnaires** | Add subjects, build multi-section question sets with per-subject customization |
| 👥 **Teacher Assignment** | Visual checklist cards with Roll No, section grouping, Tick All / Clear All |
| 💬 **Feedback Oversight** | Filter by teacher/subject/anonymity, Select All checkbox, Delete Selected + Clear All (syncs to Firestore) |
| 📋 **Attendance** | Upload CSV attendance per section, 75% threshold gate, Clear All attendance |
| 📊 **Reports & Analytics** | Institution bar chart, dept comparison, score distribution, per-teacher radar + bar, **Download Report** (HTML with SVG charts) |
| ⚙️ **System Settings** | College name, email domain, minimum threshold slider |

### 👨‍🏫 Teacher Dashboard

| View | Features |
|------|----------|
| 📊 **Overview** | Score cards, radar chart, bar chart, trend line, performance status banner |
| 💬 **Student Comments** | View all student feedback comments |
| 📈 **Score Breakdown** | Category-wise detailed scores |
| 🏢 **Department Feedback** | Rank-based comparison with department peers (individual scores hidden) |
| 📋 **Section-wise Feedback** | Breakdown by student section |
| 📄 **Download Report** | Beautiful HTML report with SVG charts, data table, comments — print as PDF |

### 🎓 Student Portal

| Feature | Description |
|---------|-------------|
| 📝 **Feedback Form** | Multi-section 1-5 star ratings, anonymous option, comments, attendance-gated (≥75%) |
| 👤 **Dashboard** | Profile with Roll No, assigned teachers list, submission status per teacher |
| 🔑 **Forgot Password** | Email-based password reset via EmailJS with secure Firestore tokens (1-hour expiry, single-use) |

---

## 🔥 Firebase Firestore Schema

| Collection | Key | Description |
|------------|-----|-------------|
| `users` | `sfft_users` | All student, teacher, admin accounts |
| `subjects` | `sfft_subjects` | Academic subjects (Math, Physics, etc.) |
| `questionnaires` | `sfft_questionnaires` | Subject-specific feedback question sets |
| `enrollments` | `sfft_enrollments` | Student ↔ Teacher assignment mappings |
| `responses` | `sfft_responses` | Submitted feedback with scores & comments |
| `attendance` | `sfft_attendance` | Student attendance records per section |
| `settings` | `sfft_settings` | College name, domain, min threshold |
| `password_resets` | — | Reset tokens with expiry for forgot password flow |
| `fcm_tokens` | — | Firebase Cloud Messaging device tokens |
| `notifications` | — | Push notification records for users |

---

## 📁 Project Structure

```
feedback/
├── 📄 index.html              # Landing page (role selection)
├── 📄 report.html             # Detailed project report page
│
├── 🔐 admin-login.html        # Admin login
├── 🔐 teacher-login.html      # Teacher login
├── 🔐 student-login.html      # Student login
├── 🔑 reset-password.html     # Forgot / Reset password (EmailJS + Firestore)
│
├── 📊 admin-dashboard.html    # Admin panel (1,968 lines — 7 tabs)
├── 📊 teacher-dashboard.html  # Teacher portal (877 lines)
├── 📊 student-dashboard.html  # Student portal (489 lines)
├── 📝 feedback-form.html      # Feedback submission form
│
├── 🔔 firebase-messaging-sw.js # Firebase Cloud Messaging service worker
│
├── 📂 css/
│   └── style.css              # Global dark theme styles (523 lines)
│
└── 📂 js/
    ├── auth.js                # Authentication & session management
    ├── charts.js              # Chart.js rendering helpers
    ├── data.js                # Data layer — CRUD + analytics (309 lines)
    ├── firebase-config.js     # Firebase initialization
    ├── firebase-sync.js       # Firestore ↔ localStorage sync (237 lines)
    └── fix_emojis.js          # Emoji compatibility
```

**Total: 5,434 lines of code across 15 source files**

---

## 🚀 Quick Start

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge, Safari)
- No server required — runs entirely client-side!

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/Vishnumgit/feedback.git

# 2. Open in browser
cd feedback
open index.html    # macOS
# or
start index.html   # Windows
```

### Default Admin Login
| Field | Value |
|-------|-------|
| Email | `admin@college.edu` |
| Password | `Admin@123` |

> 💡 First visit auto-seeds the database with default subjects, questionnaires, and the admin account.

> ⚠️ **Security Note**: Default admin passwords are now hashed with SHA-256 on first use. The system supports legacy plaintext passwords during migration and automatically upgrades them to secure hashes.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML5, CSS3, Vanilla JS | UI, interactivity, DOM manipulation |
| **Styling** | CSS Custom Properties | Dark theme with glassmorphism effects |
| **Charts** | Chart.js 4.4.0 | Radar, Bar, Doughnut, Trend charts |
| **Reports** | Inline SVG + HTML | Downloadable printable reports |
| **Database** | Firebase Firestore | Cloud NoSQL database |
| **Offline** | localStorage | Fast offline-first data access |
| **Sync** | firebase-sync.js | Background bidirectional sync |
| **Email** | EmailJS (server-side via Cloud Functions) | Password reset emails — keys never exposed in client |
| **Functions** | Firebase Cloud Functions v2 | Secure backend for password-reset flow (bcrypt hashing, token management) |
| **Auth** | Session-based (localStorage) | Role-based access control |
| **Fonts** | Google Fonts (Inter) | Professional typography |
| **Hosting** | Static files | Deploy anywhere — GitHub Pages, Netlify, etc. |

---

## 📊 Key Metrics

<div align="center">

| Metric | Value |
|--------|-------|
| 📝 Total Lines of Code | **5,434** |
| 📁 Source Files | **16** |
| 🔥 Firestore Collections | **8** |
| 👤 User Roles | **3** (Admin, Teacher, Student) |
| 📊 Chart Types | **4** (Radar, Bar, Doughnut, Trend) |
| 📄 Report Generators | **2** (Teacher + Admin) |
| 🗂️ Admin Tabs | **7** |
| 📱 Responsive | **Yes** |
| ⚡ Build Step | **None** |

</div>

---

## 📋 Recent Changes (2026-03-30)

| Category | Changes |
|----------|---------|
| ☁️ **Cloud Functions** | Add `functions/` with three callable functions (`requestPasswordReset`, `verifyResetToken`, `confirmPasswordReset`) that handle the full password-reset flow server-side using Admin SDK |
| 🔒 **Security** | Move all token/Firestore operations out of the browser; store passwords as bcrypt (server) and SHA-256 (localStorage fallback, computed server-side); EmailJS private key stored in Firebase Secret Manager |
| 🛡️ **Firestore Rules** | Explicitly deny client access to `password_resets` collection |
| 🔑 **reset-password.html** | Replace direct Firestore calls with Firebase callable function invocations; remove EmailJS browser SDK and exposed keys |
| ⚙️ **firebase-config.js** | Initialize `firebase.functions()` for callable invocations |
| 📄 **README** | Add Cloud Functions setup guide and EmailJS key configuration instructions |

---

## ☁️ Cloud Functions Setup (Password Reset)

The forgot-password / reset-password flow is backed by three Firebase Cloud Functions so that unauthenticated browsers never access Firestore directly (which would be blocked by the security rules).

### Functions overview

| Function | Description |
|----------|-------------|
| `requestPasswordReset` | Looks up the user, creates a one-time token in `password_resets`, sends the reset link via EmailJS |
| `verifyResetToken` | Checks that a token exists, is not used, and has not expired |
| `confirmPasswordReset` | Validates the token, hashes the new password with **bcrypt** (server-side), updates Firestore + Firebase Auth, marks the token used |

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- A [Firebase project](https://console.firebase.google.com/) with Firestore and Authentication enabled

### EmailJS private key

Server-side calls to the EmailJS REST API require a **private (access) token** — this is different from the public key used in the browser.

1. Log in to [EmailJS dashboard](https://dashboard.emailjs.com/) → **Account** → **API Keys**
2. Copy your **Private Key**

> ⚠️ **Never put the private key in client-side code or commit it to the repository.**

### Deploy the functions

```bash
# 1. Install dependencies
cd functions
npm install

# 2. Authenticate and select your project
firebase login
firebase use <your-firebase-project-id>   # e.g. student-feedback-form-489916

# 3. Set EmailJS secrets as environment variables
firebase functions:secrets:set EMAILJS_SERVICE_ID
firebase functions:secrets:set EMAILJS_TEMPLATE_ID
firebase functions:secrets:set EMAILJS_PUBLIC_KEY
firebase functions:secrets:set EMAILJS_PRIVATE_KEY
firebase functions:secrets:set BASE_URL
# BASE_URL should be the full URL to reset-password.html, e.g.:
#   https://vishnumgit.github.io/feedback/reset-password.html
# (The CLI will prompt you to paste each value securely)

# 4. Deploy
firebase deploy --only functions
```

The functions are deployed to the `us-central1` region by default. Change `setGlobalOptions({ region: ... })` in `functions/index.js` if you need a different region.

### EmailJS template variables

Your EmailJS template (ID stored in `EMAILJS_TEMPLATE_ID`) must contain two variables:

| Variable | Value sent |
|----------|-----------|
| `{{email}}` | Recipient email address |
| `{{link}}` | Full password-reset URL |

---

## 👨‍💻 Author

**P Vishnuvardhan Reddy**
- 🏫 MGIT — Mahatma Gandhi Institute of Technology
- 🌐 GitHub: [@Vishnumgit](https://github.com/Vishnumgit)
- 📧 pvishnuvardhanreddy_cse255a0525@mgit.ac.in

---

## 📄 License

This project is built for educational purposes at MGIT.

---

<div align="center">

**⭐ Star this repo if you found it useful!**

Made with ❤️ for better education

</div>


---

## 🔥 Firebase Setup (Required)

This project uses **Firebase Authentication** and **Firestore** for secure data management.

### Step 1: Enable Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/) → Select your project
2. Navigate to **Authentication** → **Sign-in method** tab
3. Enable **Email/Password** → Toggle ON → Save
4. Enable **Anonymous** → Toggle ON → Save (fallback for Google Sign-In)

> 💡 Both are **completely free** on the Spark plan (unlimited auth operations).

### Step 2: Deploy Firestore Security Rules

1. Go to **Firestore Database** → **Rules** tab
2. Replace existing rules with the content from [`firestore.rules`](./firestore.rules)
3. Click **Publish**

### Security Model

> **Updated**: Security rules now use explicit per-collection access control instead of a catch-all rule. Anonymous auth users can read whitelisted collections but cannot write to sensitive ones. All unlisted collections are denied by default.

| Role | Users | Subjects | Enrollments | Responses | Settings |
|------|-------|----------|-------------|-----------|----------|
| **Admin** | Read/Write All | Read/Write | Read/Write | Read/Write/Delete | Read/Write |
| **Student** | Read Own | Read | Read | Read + Create | Read |
| **Teacher** | Read Own | Read | Read | Read | Read |
| **Unauthenticated** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked | ❌ Blocked |

### Auto-Migration

Existing users (from localStorage) are **automatically migrated** to Firebase Auth on their first login. No manual account creation needed — the system handles it seamlessly.

### Free Plan Limits

| Resource | Free Limit | Our Usage |
|----------|-----------|-----------|
| Authentication | Unlimited | ✅ Well within |
| Firestore Reads | 50,000/day | ✅ Reduced by role-based sync + 5-min cache |
| Firestore Writes | 20,000/day | ✅ Reduced by security rules blocking unauthorized writes |
| Storage | 1 GiB | ✅ Minimal |


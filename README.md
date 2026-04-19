<div align="center">

# 🎓 Student Feedback System

### A Modern, Multi-Role Feedback Collection & Analytics Platform for Educational Institutions

[![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)
[![Python](https://img.shields.io/badge/Python_OTP-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.pythonanywhere.com/)

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


## 🔐 Authentication (Backend — Firebase Auth)

> **Updated April 2026:** Authentication was migrated from localStorage to **Firebase Auth** as the single source of truth. Login now works reliably on any device, any browser.

### How It Works

| Step | What Happens |
|------|-------------|
| **Admin adds user** | Firebase Auth account created via REST API + profile saved to Firestore |
| **User logs in (any device)** | `signInWithEmailAndPassword()` → profile loaded from Firestore → session created |
| **Google Sign-In** | Firebase Auth via Google credential → profile loaded → session created |
| **Password change** | Firebase Auth `updatePassword()` + local hash updated |

### Key Files

- `js/auth.js` — Login, logout, session management (Firebase Auth primary)
- `js/data.js` — User CRUD (`addUser` creates Firebase Auth accounts)
- `js/firebase-config.js` — Firebase initialization
- `js/firebase-sync.js` — Firestore ↔ localStorage sync
- `firestore.rules` — Security rules (public read on `users` + `settings`, write requires auth)

### Default Passwords

- **Admin** (`admin@college.edu`): `Admin@123`
- **Students/Teachers**: `12345678`
- Users should change their passwords after first login via the dashboard.

### Firestore Security Rules

```
settings → public read, authenticated write
users → public read, authenticated write  
All other collections → authenticated read/write only
```


## ✨ Key Highlights

| Feature | Description |
|---------|-------------|
| 🌙 **Dark Theme UI** | Beautiful dark glassmorphism design with purple accent theme |
| 🔐 **3 Role-Based Portals** | Separate dashboards for Admin, Teacher, and Student |
| 📊 **Rich Analytics** | Radar, Bar, Doughnut, and Trend charts powered by Chart.js |
| 📄 **Report Generator** | Downloadable HTML reports with SVG charts — print as PDF |
| 🔥 **Firebase Cloud Sync** | Offline-first with automatic Firestore background sync |
| 📱 **Responsive Design** | Works on desktop, tablet, and mobile screens |
| 🔑 **Password Reset** | Cloud Functions–backed forgot-password flow — OTP verification via Python Gmail SMTP (PythonAnywhere) |
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
| 🔑 **Forgot Password** | OTP-based password reset via Python Gmail SMTP hosted on PythonAnywhere (6-digit code, 5-min expiry, 3 attempts) |

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
├── 🔑 reset-password.html     # Forgot / Reset password (OTP via PythonAnywhere)
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
| **Email** | PythonAnywhere (Python Flask + Gmail SMTP) | OTP verification emails — credentials stored server-side |
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
| 🔒 **Security** | Move all token/Firestore operations out of the browser; store passwords as bcrypt (server) and SHA-256 (localStorage fallback, computed server-side); PythonAnywhere OTP private key stored in Firebase Secret Manager |
| 🛡️ **Firestore Rules** | Explicitly deny client access to `password_resets` collection |
| 🔑 **reset-password.html** | Replace direct Firestore calls with Firebase callable function invocations; remove PythonAnywhere OTP browser SDK and exposed keys |
| ⚙️ **firebase-config.js** | Initialize `firebase.functions()` for callable invocations |
| 📄 **README** | Add Cloud Functions setup guide and PythonAnywhere OTP key configuration instructions |

---

## ☁️ Cloud Functions Setup (Password Reset)

The forgot-password / reset-password flow is backed by three Firebase Cloud Functions so that unauthenticated browsers never access Firestore directly (which would be blocked by the security rules).

### Functions overview

| Function | Description |
|----------|-------------|
| `requestPasswordReset` | Looks up the user, creates a one-time token in `password_resets`, sends OTP via Gmail SMTP (PythonAnywhere) |
| `verifyResetToken` | Checks that a token exists, is not used, and has not expired |
| `confirmPasswordReset` | Validates the token, hashes the new password with **bcrypt** (server-side), updates Firestore + Firebase Auth, marks the token used |

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- A [Firebase project](https://console.firebase.google.com/) with Firestore and Authentication enabled

### 🐍 PythonAnywhere OTP Setup

The password reset system uses a **Python Flask API** hosted for free on PythonAnywhere that sends OTP codes via Gmail SMTP.

#### How the OTP Flow Works

```
User clicks "Forgot Password"
  → Enters email
  → Website calls PythonAnywhere API (/send-otp)
  → Python generates 6-digit OTP
  → Gmail SMTP sends styled OTP email
  → User enters OTP code
  → Website calls PythonAnywhere API (/verify-otp)
  → Python verifies (3 attempts, 5-min expiry)
  → User sets new password
  → Password updated in localStorage + Firestore
```

#### Setup Steps

1. **Create free account** at [pythonanywhere.com](https://www.pythonanywhere.com)
2. **Create a Flask web app** (Web tab → Add new web app → Flask → Python 3.10)
3. **Paste the OTP code** into `mysite/flask_app.py`:

```python
import smtplib, random, time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import Flask, request, jsonify

app = Flask(__name__)
SENDER_EMAIL = "your-email@gmail.com"      # Your Gmail
SENDER_PASSWORD = "xxxx xxxx xxxx xxxx"     # Gmail App Password
otp_store = {}

@app.after_request
def cors(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    return response

@app.route("/send-otp", methods=["POST", "OPTIONS"])
def send_otp():
    if request.method == "OPTIONS": return jsonify({"ok": True})
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    otp = str(random.randint(100000, 999999))
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your OTP Code"
    msg["From"] = SENDER_EMAIL
    msg["To"] = email
    msg.attach(MIMEText(f"<h1>{otp}</h1><p>Expires in 5 minutes.</p>", "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
        s.login(SENDER_EMAIL, SENDER_PASSWORD)
        s.sendmail(SENDER_EMAIL, email, msg.as_string())
    otp_store[email] = {"otp": otp, "expires_at": time.time() + 300, "attempts": 0}
    return jsonify({"success": True, "message": "OTP sent!"})

@app.route("/verify-otp", methods=["POST", "OPTIONS"])
def verify_otp():
    if request.method == "OPTIONS": return jsonify({"ok": True})
    data = request.get_json()
    email, user_otp = data.get("email","").lower(), data.get("otp","")
    rec = otp_store.get(email)
    if not rec or time.time() > rec["expires_at"]: return jsonify({"success": False, "message": "OTP expired."})
    if rec["attempts"] >= 3: return jsonify({"success": False, "message": "Too many attempts."})
    if rec["otp"] == user_otp:
        del otp_store[email]
        return jsonify({"success": True, "message": "Verified!"})
    rec["attempts"] += 1
    return jsonify({"success": False, "message": f"Wrong OTP. {3-rec['attempts']} left."})
```

4. **Set your Gmail App Password** (Google Account → Security → 2-Step Verification → App Passwords)
5. **Click Reload** on PythonAnywhere Web tab
6. **Update `reset-password.html`** to point to your PythonAnywhere URL

#### API Endpoints

| Endpoint | Method | Body | Response |
|----------|--------|------|----------|
| `/send-otp` | POST | `{"email": "user@college.edu"}` | `{"success": true, "message": "OTP sent!"}` |
| `/verify-otp` | POST | `{"email": "...", "otp": "123456"}` | `{"success": true/false, "message": "..."}` |

#### Security Features
- 🔢 **6-digit random OTP** (100000–999999)
- ⏱️ **5-minute expiry**
- 🚫 **3 attempt limit** per OTP
- 🔒 **Gmail App Password** (not regular password)
- 🌐 **CORS enabled** for cross-origin requests
- 📧 **Styled HTML emails** with purple theme


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


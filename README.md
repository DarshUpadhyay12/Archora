# 🏛️ Archora Studio — AI Architecture Workspace & VastuVision Studio

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3.5%20Flash%20Lite-4285F4?logo=google&logoColor=white)](https://aistudio.google.com/)
[![QA Tests](https://img.shields.io/badge/QA%20Tests-36%2F36%20Passing-success)](https://github.com/DarshUpadhyay12/Archora)

**Archora** is a professional-grade, intelligent architectural studio workspace engineered specifically for architecture students, educators, and design practitioners. 

Inspired by the tactile richness of classic architectural treatises, copperplate engravings, and drafting manuscripts, Archora combines a warm parchment and espresso aesthetic with high-performance **3D Glassmorphism**, local **persistent SQLite storage**, official **Google Gemini AI studio tutors**, **jury defense simulators**, and an advanced **AI VastuVision** directional planning engine.

---

## ⚡ Quick Start: Everyday Desktop Launch

After the initial setup, you never have to touch a terminal:

| Action | How to do it |
| :--- | :--- |
| **🚀 Start Archora** | Double-click the **`Archora`** icon on your **Windows Desktop**.<br>*(Launches in 1-2 seconds and opens `http://localhost:5000`)* |
| **🛑 Stop Archora** | Double-click **`stop-archora.bat`** in the Archora folder (or press `Ctrl+C`). |
| **🔄 Restart Archora** | Double-click **`restart-archora.bat`** in the Archora folder. |

👉 For full step-by-step installation instructions, see the [Installation Guide](INSTALLATION_GUIDE.md).

---

## 🌟 Key Features

### 1. 🏛️ Premium 3D Glassmorphism UI
- **Parchment & Espresso Design System**: Warm cream drafting surfaces, translucent glass panels with real backdrop blur (`backdrop-blur-md`), fine architectural borders, and floating depth hierarchies.
- **Interactive 3D Architectural Models**: Real-time Three.js canvas featuring parametric classical buildings, rotatable camera orbits, day/dusk/night architectural illumination, and isometric wireframe overlays.
- **Authentic Copperplate Linework**: Seamlessly feathered high-resolution architectural sketches embedded directly into cotton parchment textures with zero hard borders.

### 2. 🧭 AI VastuVision — Vedic Architectural Planning Engine
- **Vastu Purusha Mandala Analysis**: 8 cardinal & intercardinal directional quadrants plus the sacred *Brahmasthan* center.
- **Five Elemental Balances (*Pancha Bhuta*)**: Real-time evaluation of Fire (*Agni* / SE), Water (*Jal* / NE), Earth (*Prithvi* / SW), Air (*Vayu* / NW), and Space (*Akash* / Center).
- **Interactive Floor Plan Grid**: Upload architectural sketches or design on a blank grid with drag-and-drop room nodes (Master Bedroom, Kitchen, Pooja Room, Water Tank, Staircase, etc.).
- **Directional Compliance Scoring**: Instant 0–100% Vastu score, dosha detection, and traditional Vedic remedy suggestions.

### 3. 🎓 Studio AI Architecture Tutor
- Architectural theory guidance grounded in the Vitruvian Triad (*Firmitas*, *Utilitas*, *Venustas*), Kenneth Frampton's Tectonic Culture, spatial hierarchies, and passive climatic design.
- Direct citation of classic architectural treatises and precedents.

### 4. 💡 AI Design Concept Generator
- Generate comprehensive architectural concepts from brief prompts: site context, typologies, climate responses, structural systems, and material palettes.

### 5. 🛡️ Tough Jury & Defense Simulator
- Simulates realistic architecture jury defenses with varying critic personalities (Strict Pragmatist, Sustainable Theorist, Poetic Formalist).
- Prepares students for tough defense questions with tailored counter-arguments and presentation tips.

### 6. 📁 Persistent Project Library & Portfolio
- Full architectural project management: site location, typography, semester, design notes, drawings, and CAD exports.
- All stored securely in a local SQLite database on your machine.

### 7. ☁️ Google Drive Cloud Backup & Export
- 1-Click encrypted cloud backup to Google Drive.
- Multi-format exports: High-resolution PDF studio portfolios, JSON project archives, and complete database snapshots.

### 8. 📱 Universal Responsive PWA
- Progressive Web App support: Install as a standalone desktop or mobile application.
- Works offline with smart caching of linework and UI components.

---

## 🚀 First-Time Installation

### Prerequisites
- **Node.js (v18.0.0 or higher)**: [Download Node.js](https://nodejs.org/)
- **Git**: [Download Git](https://git-scm.com/)

### 1-Click Automated Setup (Windows)
1. Clone the repository:
   ```bash
   git clone https://github.com/DarshUpadhyay12/Archora.git
   cd Archora
   ```
2. Double-click **`setup-archora.bat`**.
   *That's it!* The setup script will:
   - Check Node.js requirements.
   - Install all dependencies (`npm install`).
   - Create your `.env` configuration file.
   - Initialize the persistent SQLite database directory.
   - Build the production client application.
   - **Create the "Archora" Desktop Shortcut** on your Windows Desktop.
3. Double-click the **`Archora`** desktop shortcut to launch!

---

## ⚙️ Configuration (.env)

Archora runs out-of-the-box with sensible defaults. To enable AI studio tutoring and Google Drive cloud backups, configure `.env` (copied from `.env.example`):

```env
# Google Gemini AI (100% Free Tier eligible: gemini-3.5-flash-lite)
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
GEMINI_MODEL=gemini-3.5-flash-lite

# Web Server Port
PORT=5000

# Optional: Persistent SQLite Database Path (Defaults to D:\Archora\data\archora.db)
# DATABASE_PATH=D:\Archora\data\archora.db

# Google Drive Cloud Backup (Optional)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback
```

> **Zero-Cost Guarantee**: By default, Archora uses Google's `gemini-3.5-flash-lite` model, which falls completely within Google's free-of-charge API tier for individual educational use.

---

## 📂 Project Architecture

```
Archora/
├── public/                 # Static assets, icons, copperplate sketches, manifest
├── scripts/                # Windows PowerShell automation, setup, and QA suites
│   ├── setup-archora.ps1   # Full automated dependency & desktop setup
│   ├── start-archora.ps1   # Fast multi-port startup and health-check runner
│   ├── stop-archora.ps1    # Safe multi-process killer
│   ├── create-shortcut.ps1 # Windows Desktop .lnk shortcut generator
│   └── run-full-qa.ts      # 36-point master QA verification suite
├── server/                 # Express backend API & Database engine
│   ├── db/                 # SQLite database connection & pragmas (WAL mode)
│   │   ├── migrations/     # Versioned SQL migration scripts
│   │   └── schema.sql      # Canonical database schema
│   ├── routes/             # RESTful API endpoints (auth, projects, ai, vastu, drive)
│   ├── services/           # Gemini AI service, Vastu engine, Drive cloud backup
│   └── tests/              # Isolated integration and QA test suites
├── src/                    # React 19 Frontend (Vite + Tailwind CSS + Lucide)
│   ├── components/         # 3D Glassmorphism UI components
│   │   ├── 3d/             # Three.js 3D architectural building models
│   │   ├── vastu/          # VastuVision interactive directional analyzer
│   │   ├── layout/         # Glass navigation, headers, and footer
│   │   └── ui/             # Glass buttons, modals, badges, dropzones
│   ├── pages/              # Studio views (Home, Tutor, Concepts, Portfolio, Vastu, Library)
│   ├── services/           # Client API connectors & storage services
│   └── styles/             # Glassmorphism utilities & parchment color themes
├── Archora.bat             # 1-Click Windows desktop launcher proxy
├── setup-archora.bat       # 1-Click Windows full setup
├── start-archora.bat       # 1-Click fast server launcher
├── stop-archora.bat        # 1-Click server stop
├── INSTALLATION_GUIDE.md   # Step-by-step setup documentation
└── README.md               # Main project documentation
```

---

## 🔒 Security & Data Integrity

Archora follows strict **Security-First Vibe Coding Rules**:
- **Zero Secret Exposure**: `.env`, API credentials, and private keys are strictly git-ignored and never exposed to the frontend.
- **SQL Injection Immune**: 100% of database queries use parameterized SQL prepared statements.
- **User Data Isolation**: Multi-tenant data segregation enforced with `WHERE user_id = ?` on every query.
- **Cryptographic Passwords**: Bcrypt hashing with 10 salt rounds for all user accounts.
- **Strict Rate Limiting & Helmet**: Protected endpoints with rate limiting, secure HTTP headers, and strict CORS.

---

## 🧪 Testing & Verification

Archora includes an automated, self-contained end-to-end QA test suite:

```bash
npm run test:qa
```

### Verification Matrix (36/36 Tests Passing)
- **Suite 1: Database & Migration Integrity**: Schema creation, WAL mode, foreign key cascade, indexing.
- **Suite 2: Authentication & Security**: Register, login, duplicate detection, password hashing, session revocation.
- **Suite 3: Project Management**: Multi-attribute projects, file attachments, cross-user isolation.
- **Suite 4: AI Architecture Services**: Vitruvian prompt integrity, token safety, context retention.
- **Suite 5: Google Drive Cloud Backup**: OAuth callback, token persistence, folder mapping.
- **Suite 6: VastuVision Engine**: Directional calculations, 5-element balance, Dosha remedies, 8-zone scoring.

---

## 📜 License & Credits

Created by **Darsh Upadhyay** and contributors.  
Designed for architecture students worldwide.  
Licensed under the [MIT License](LICENSE).

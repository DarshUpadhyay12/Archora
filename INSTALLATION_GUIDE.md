# 🏛️ Archora Studio — Complete Installation & Quick-Access Guide

Welcome to **Archora Studio**! This guide walks you through setting up Archora on your computer for the very first time, and how to instantly launch it whenever you need it using your **Windows Desktop Icon**.

---

## ⚡ Quick Reference: Daily Everyday Usage

After the one-time installation is finished, you do **not** need to open any terminal, write commands, or remember ports!

### 🖱️ How to Launch Archora (1-2 Seconds):
1. Go to your **Windows Desktop**.
2. Double-click the **`Archora`** desktop shortcut icon (with the custom architectural column icon).
3. Archora will start automatically in the background and open your default web browser to:
   👉 **`http://localhost:5000`**

### 🛑 How to Stop Archora:
- Double-click **`stop-archora.bat`** in the project folder, or press `Ctrl + C` in the launcher console window.

---

## 📥 First-Time Installation (One-Time Setup)

Follow these simple steps when downloading or cloning Archora onto a computer for the first time.

### 📋 Prerequisites
Before you start, make sure you have:
1. **Node.js (v18.0.0 or higher)**:
   - Download the LTS version from: [https://nodejs.org/](https://nodejs.org/)
   - Verify by opening PowerShell or Command Prompt and typing:
     ```powershell
     node -v
     ```
2. **Git**:
   - Download from: [https://git-scm.com/](https://git-scm.com/)

---

### Method A: Automated 1-Click Setup (Recommended for Windows)

This is the fastest, completely automated method. It installs all dependencies, sets up the persistent database, builds the production frontend, and places the **Archora** desktop shortcut directly onto your Windows Desktop.

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/DarshUpadhyay12/Archora.git
   cd Archora
   ```
   *(Or download the repository ZIP file from GitHub and extract it to your preferred folder, e.g., `D:\Archora` or `C:\Archora`)*.

2. **Run the 1-Click Setup**:
   - In File Explorer, simply **double-click `setup-archora.bat`** in the root of the Archora folder.
   - *OR* in PowerShell, run:
     ```powershell
     .\setup-archora.bat
     ```

3. **What happens during setup**:
   - Verifies your Node.js version.
   - Automatically initializes `.env` from `.env.example`.
   - Automatically creates the persistent SQLite database directory (prioritizing `D:\Archora\data` or `%LOCALAPPDATA%\Archora\data`).
   - Runs `npm install` for all dependencies.
   - Builds the production React + Vite application.
   - **Creates the "Archora" Desktop Shortcut** on your Windows Desktop (supporting standard Windows Desktop and OneDrive synced Desktops).

4. **Launch the Studio**:
   - Double-click the newly created **Archora** desktop icon!
   - Your browser will open to `http://localhost:5000`.

---

### Method B: Manual / Terminal Setup (Cross-Platform)

If you prefer using the terminal or are running on macOS / Linux:

1. **Clone & Enter Folder**:
   ```bash
   git clone https://github.com/DarshUpadhyay12/Archora.git
   cd Archora
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   - Copy the sample `.env.example` file to `.env`:
     ```bash
     # Windows (cmd):
     copy .env.example .env

     # Windows (PowerShell) / Mac / Linux:
     cp .env.example .env
     ```
   - Open `.env` and add your free Google Gemini API key:
     ```env
     GEMINI_API_KEY=your_actual_gemini_api_key_here
     GEMINI_MODEL=gemini-3.5-flash-lite
     PORT=5000
     ```
     *(Get your free key at [Google AI Studio](https://aistudio.google.com/))*

4. **Build the Application**:
   ```bash
   npm run build
   ```

5. **Start the Application**:
   ```bash
   npm start
   ```
   - Access the studio at: `http://localhost:5000` (or frontend dev server at `http://localhost:3000`).

---

## 🖥️ How the Windows Desktop Icon Works

Archora includes a custom PowerShell automation script (`scripts/create-shortcut.ps1`) that automatically configures Windows Shell shortcuts:

```
[Windows Desktop]
       │
       ▼ (Double-Click)
   Archora.lnk  ──►  start-archora.bat
                            │
                            ├──► Verifies Node.js & .env
                            ├──► Verifies DB directory (D:\Archora\data)
                            ├──► Starts Express Backend (Port 5000)
                            ├──► Serves 3D Glassmorphism Studio Frontend
                            └──► Automatically launches default browser at http://localhost:5000
```

### What if the Desktop Icon is missing or moved?
You can re-create or restore the desktop icon at any time by running:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\create-shortcut.ps1
```
Or simply double-click `setup-archora.bat` again.

---

## 🔑 AI Configuration (Google Gemini Free Tier)

Archora uses Google's latest `gemini-3.5-flash-lite` model for 100% free studio tutoring, design concept generation, jury defense prep, and Vastu analysis.

1. Visit [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google Account and click **"Create API Key"** (100% free, no credit card required).
3. **Save your key into Archora using either method:**
   - **Option 1 (Easiest — No code editor needed)**:  
     Double-click **`configure-key.bat`** in the Archora folder, paste your key, and press Enter!
   - **Option 2 (Using Windows Notepad)**:  
     Right-click the `.env` file in the Archora folder ➔ Select **Open with** ➔ Choose **Notepad**.  
     Paste your key:
     ```env
     GEMINI_API_KEY=AIzaSy...
     ```
     Click **File ➔ Save**.
*(Note: Your API key is strictly stored locally on your machine and is NEVER committed to git or exposed to clients).*

---

## ☁️ Google Drive Cloud Backup (Optional)

Archora supports 1-click cloud backup of your SQLite projects and database directly to your personal Google Drive:

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable the **Google Drive API**.
3. Create an **OAuth 2.0 Client ID** (Web application).
   - Authorized redirect URI: `http://localhost:5000/api/google/callback`
4. Add credentials to your `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_secret
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback
   ```
5. In Archora Studio, navigate to **Profile / Settings -> Cloud Backup** to connect your account and trigger instant backups.

---

## 🛠️ Troubleshooting & FAQs

### Q1: When I double-click the desktop icon, it says "Node.js is not installed".
- **Fix**: Download and install Node.js v18 or higher from [nodejs.org](https://nodejs.org/). Make sure the "Add to PATH" option is checked during installation. Restart your computer if needed.

### Q2: Port 5000 is already in use by another application.
- **Fix**: Open `.env` and change `PORT=5000` to an available port (e.g. `PORT=5050`). You can also run `stop-archora.bat` to clear any stuck Archora processes.

### Q3: Where is my architectural project data stored?
- **Data Location**: Archora stores your projects in a persistent SQLite database at `D:\Archora\data\archora.db` (or `%LOCALAPPDATA%\Archora\data\archora.db`). Your data stays completely offline and private on your computer.

### Q4: How do I run the automated QA verification tests?
- Run:
  ```powershell
  npm run test:qa
  ```
  This runs all 36 end-to-end integration tests for authentication, projects, AI services, Google Drive, and VastuVision.

---

🏛️ **Happy Designing with Archora Studio!**


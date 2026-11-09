# ARCHORA — WINDOWS SETUP & USER GUIDE

This guide explains how to set up, launch, stop, and manage your **Archora** AI Architecture Workspace on Windows 11.

---

## 1. Quick Start: The One-Click Experience

Once set up, your day-to-day workflow is as simple as:

1. **Double-click** the **Archora** shortcut on your Windows Desktop (or double-click `start-archora.bat` / `Archora.bat`).
2. The launcher automatically starts the backend server and frontend interface in ~1-2 seconds.
3. Archora automatically opens in your default web browser at:
   ```
   http://127.0.0.1:3000
   ```
4. When you finish your studio session, either:
   - Press **`Q`** or close the launcher console window, or
   - Double-click **`stop-archora.bat`** in the project folder.

---

## 2. GitHub Clone & Friend Workflow (Zero Manual Setup)

If you send the repository to a friend or clone it from GitHub onto a fresh PC:

**Your friend does NOT need to manually run npm install or setup scripts.**

1. **Friend downloads / clones the repository.**
2. **Friend double-clicks `start-archora.bat` (or `Archora.bat`).**
3. **Automated First-Time Setup:**
   - Detects that `node_modules` is missing.
   - Creates a default `.env` from `.env.example`.
   - Runs `npm install` **once**.
   - Builds the production frontend bundle **once**.
   - Automatically generates the **Archora Desktop Shortcut** on their Windows Desktop.
   - Immediately launches the browser at `http://127.0.0.1:3000`.
4. **All Future Double-Clicks:**
   - Because `node_modules` is now installed, it skips installation completely.
   - Starts both backend and frontend **instantly in 1-2 seconds** without waiting!

---

## 2. One-Time Setup Instructions

Before launching Archora for the first time on a new Windows installation, run the automated setup script:

### Step 1: Open the Archora Folder
Navigate to your Archora installation folder (e.g., `D:\Archora`).

### Step 2: Run Setup
Double-click:
```bat
setup-archora.bat
```
*(Or in PowerShell / Terminal: `npm run setup`)*

### What Setup Automatically Does:
1. **Checks Node.js and npm**: Verifies that Node.js (v18+) and npm are installed and in your system PATH.
2. **Preserves Environment Settings**: Checks for `.env`. If found, it **preserves** your existing configuration and never overwrites it. If missing, it creates `.env` from `.env.example`.
3. **Verifies Gemini API Key**: Confirms that your `GEMINI_API_KEY` is present and masked (without exposing secrets).
4. **Initializes Persistent Storage**: Creates local persistent folders under `%LOCALAPPDATA%\Archora\` (`data`, `uploads`, `backups`, `runtime`).
5. **Verifies Dependencies**: Verifies project dependencies in `node_modules` (installs via `npm install` if missing).
6. **Generates Studio Icons**: Generates high-resolution `arch-icon.ico` (256x256 down to 16x16) from the official Archora architectural arch vector.
7. **Verifies Production Build**: Runs `npm run build` (`tsc -b && vite build`) to confirm clean compilation.
8. **Creates Windows Desktop Shortcut**: Creates the **Archora** shortcut on your Windows Desktop with the custom icon and correct working directory.

---

## 3. Starting, Stopping & Restarting

All operations can be managed via simple batch files in the Archora folder:

| Action | Script to Run | Description |
| :--- | :--- | :--- |
| **Start Archora** | `start-archora.bat` | Starts backend on `127.0.0.1:5000`, starts frontend on `127.0.0.1:3000`, waits for health readiness, and opens your browser. |
| **Stop Archora** | `stop-archora.bat` | Safely stops Archora-owned processes. Frees ports 5000 and 3000. **Never touches unrelated Node.js processes.** |
| **Restart Archora** | `restart-archora.bat` | Performs a clean shutdown followed by a fresh start. |

> [!NOTE]
> **Duplicate Protection:** If you double-click the Archora shortcut while Archora is already running, the launcher detects the healthy services, opens a new browser tab, and closes without spawning duplicate processes or conflicting ports.

---

## 4. Where Application Data is Stored

All user data is stored persistently outside the project source code in the standard Windows local application directory:

```
%LOCALAPPDATA%\Archora\
├── data\
│   └── archora.db          <- SQLite database (user accounts, projects, notes, conversations, usage)
├── uploads\
│   └── <userId>\           <- Uploaded drawings, CAD files, PDFs, site plans
├── backups\
│   └── Archora-Backup-*.zip <- Local backup archives
└── runtime\
    ├── archora-pids.json   <- Active process IDs
    ├── backend.log         <- Server log output
    └── frontend.log        <- Vite interface log output
```

*(To quickly open this folder in Windows Explorer, press `Win + R`, type `%LOCALAPPDATA%\Archora`, and press Enter).*

> [!IMPORTANT]
> Your data is completely persistent across Windows restarts, upgrades, and application rebuilds. It is never placed in temporary cache directories.

---

## 5. Configuring Google Gemini AI Credentials

Archora uses Google's free-tier **`gemini-3.5-flash-lite`** model for the Architecture Tutor, Design Concept Generator, and Jury & Portfolio Assistant.

### How to configure:
1. Open `.env` in the Archora root folder with any text editor (Notepad, VS Code).
2. Set your free Google AI Studio API key:
   ```env
   GEMINI_API_KEY=AIzaSy...your_actual_key_here
   GEMINI_MODEL=gemini-3.5-flash-lite
   PORT=5000
   ```
3. Get a free API key at: [Google AI Studio](https://aistudio.google.com/)
4. Save the file.
5. If Archora is currently running, run `restart-archora.bat` to apply the key.

---

## 6. Configuring Google Drive Cloud Backups

Archora allows syncing backups directly to your dedicated Google Drive folder:

- **Target Folder URL:** `https://drive.google.com/drive/folders/1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl?usp=sharing`
- **Target Folder ID:** `1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl`

### Setup:
1. In the Google Cloud Console, create an OAuth 2.0 Client ID (Web Application).
2. Set the Authorized redirect URI to:
   ```
   http://localhost:5000/api/google/callback
   ```
3. Add your client credentials to `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/callback
   GOOGLE_DRIVE_FOLDER_ID=1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl
   ```
4. In Archora, navigate to **Backup & Restore -> Google Drive Cloud**, click **Connect Google Drive**, and authorize your account.

---

## 7. How to Recreate the Shortcut if the Project is Moved

If you move the Archora folder (e.g. from `D:\Archora` to `C:\Archora` or an external SSD):

1. Open the new folder location.
2. Double-click:
   ```bat
   setup-archora.bat
   ```
   *(Or run `powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1`)*
3. The script dynamically updates the Windows Desktop shortcut target, working directory, and icon path to the new location.

---

## 8. Backup and Restore Procedures

### Creating a Local Backup:
- Inside Archora: Go to **Backup & Restore**, click **Create Backup**. An atomic `.zip` archive containing your entire SQLite database, drawings, and PDF exports will be generated in `%LOCALAPPDATA%\Archora\backups\`.
- Or click **Download Backup** in the UI to save the archive anywhere on your computer.

### Restoring from Backup:
- Go to **Backup & Restore**, select any existing backup or upload a previous `.zip` archive, and click **Restore**.
- Archora automatically takes a **pre-restore safety snapshot** before altering files, ensuring zero data loss if an archive is invalid.

---

## 9. Troubleshooting Common Errors

### Error: "Port 5000 or Port 3000 is occupied by an external service"
- **Cause:** Another program is using port 5000 or 3000.
- **Solution:** 
  1. Open Command Prompt and check what is using the port:
     ```cmd
     netstat -ano | findstr :5000
     ```
  2. If an old Archora process was left behind, run `stop-archora.bat`.
  3. If another application needs port 5000, change `PORT=5001` in `.env` and restart.

### Error: "Node.js is not recognized"
- **Cause:** Node.js is not installed or not in your Windows PATH.
- **Solution:** Download and install Node.js v18 or later (LTS recommended) from [nodejs.org](https://nodejs.org/). Ensure the checkbox *"Add to PATH"* is checked during installation, then restart your terminal.

### The browser opens, but shows "Unable to connect"
- **Cause:** The frontend or backend service took longer to initialize on an older machine.
- **Solution:** Refresh the browser after a few seconds (`Ctrl + F5`). The launcher waits up to 20 seconds for readiness before reporting an error.

### Error: "Cannot access backend.log / frontend.log"
- **Cause:** File handle held momentarily during a rapid restart.
- **Solution:** Wait 2 seconds and rerun `start-archora.bat`.

---
*Archora Architecture Studio — Engineering & Deployment Team.*


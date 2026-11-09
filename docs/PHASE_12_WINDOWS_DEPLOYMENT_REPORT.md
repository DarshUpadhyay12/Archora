# ARCHORA — PHASE 12: WINDOWS DEPLOYMENT, ONE-CLICK STARTUP & DESKTOP SHORTCUT REPORT

**Document Version:** 1.0.0  
**Deployment Date:** November 2, 2026  
**Auditor / Specialist:** Senior Windows Deployment Engineer & Full-Stack Deployment Specialist  
**Application Name:** **Archora** (AI Architecture Workspace)  
**Deployment Verdict:** **100% PASSED — READY FOR DAILY PRODUCTION USE**  

---

## 1. Executive Summary & Verification Verdict

Phase 12 of **Archora** has been implemented and verified on Windows 11. The application now provides a seamless native desktop user experience while maintaining a clean, secure, local browser-based architecture:

> **The Archora User Experience:**  
> **Double-click Desktop Shortcut → Archora Services Start Automatically → Browser Opens to `http://127.0.0.1:3000` → Studio is Active → Close Window or run `stop-archora.bat` when Finished.**

All user requirements, strict constraints, and edge cases (preventing duplicate instances, never terminating unrelated Node.js processes, preserving all database and uploaded files, and securing API secrets) have been fulfilled and validated through automated testing.

---

## 2. Windows Startup & Shutdown Architecture

A suite of production-grade batch scripts and PowerShell automation engines was built and integrated into the project root:

| Script File | Engine / Target | Role & Capabilities |
| :--- | :--- | :--- |
| **`start-archora.bat`** | `scripts/start-archora.ps1` | **One-Click Startup:** Checks for already-running instances, starts backend (`5000`) and frontend (`3000`), monitors health readiness, opens the default browser to `http://127.0.0.1:3000`, and tracks PIDs. Supports interactive console monitoring with quick `[Q]` exit or background mode (`-Detach`). |
| **`stop-archora.bat`** | `scripts/stop-archora.ps1` | **Safe Shutdown:** Reads runtime PIDs, verifies that processes belong strictly to Archora before stopping, frees ports 5000 and 3000, and cleans up PID files. **Guaranteed zero termination of unrelated Node.js processes.** |
| **`restart-archora.bat`** | `stop` + `start` | **Seamless Studio Restart:** Gracefully stops active services, pauses 2 seconds, and launches fresh services. |
| **`setup-archora.bat`** | `scripts/setup-archora.ps1` | **One-Time Environment Setup:** Checks Node.js/npm, validates `.env` without printing secrets, prepares `%LOCALAPPDATA%\Archora\` storage directories, generates multi-resolution icon, runs `npm run build`, and creates the Desktop shortcut. |
| **`scripts/create-shortcut.ps1`** | Windows Script Host | **Dynamic Shortcut Generator:** Creates `Archora.lnk` on `%USERPROFILE%\Desktop`, points to `start-archora.bat`, assigns working directory dynamically, and sets `public\arch-icon.ico`. |
| **`scripts/generateIcon.ps1`** | System.Drawing (.NET) | **Vector Icon Engine:** Generates `public/arch-icon.ico` with 6 standard Windows resolutions (256, 128, 64, 48, 32, 16 px) featuring the Archora architectural arch in espresso `#482A18` and warm amber `#B45309`. |

---

## 3. Localhost & Loopback Configuration

- **Target Frontend URL:** `http://127.0.0.1:3000`
- **Target Backend URL:** `http://127.0.0.1:5000`
- **Strict Loopback Binding:**
  - `vite.config.ts`: Configured `server: { host: '127.0.0.1', port: 3000, proxy: { '/api': { target: 'http://127.0.0.1:5000' } } }`.
  - `server/index.ts`: Configured `app.listen(Number(PORT), HOST, ...)` where `HOST = process.env.HOST || '127.0.0.1'`.
- **Security & Firewall Impact:**
  - Binding to `127.0.0.1` prevents exposing the application to local area networks (LAN) or public interfaces.
  - Windows Defender Firewall does not prompt for elevated network inbound permissions.

---

## 4. Desktop Shortcut & Custom Architectural Icon

- **Shortcut Location:** `C:\Users\darsh\OneDrive\Apps\Desktop\Archora.lnk` (and `%USERPROFILE%\Desktop\Archora.lnk`).
- **Shortcut Name:** **Archora**
- **Shortcut Target:** `D:\Archora\start-archora.bat`
- **Working Directory:** `D:\Archora` (resolved dynamically from project location).
- **Application Icon:** `D:\Archora\public\arch-icon.ico`
  - Validated multi-resolution Windows ICO containing 6 distinct resolutions (16x16, 32x32, 48x48, 64x64, 128x128, 256x256).
  - Also copied to `public/favicon.ico` so the browser tab matches the desktop shortcut icon.

---

## 5. Duplicate Instance Prevention & Port Conflict Handling

- **Already-Running Detection:**
  When `start-archora.bat` is executed, it first queries `http://127.0.0.1:5000/api/health` and `http://127.0.0.1:3000`. If both are active with the authentic Archora service signature:
  1. It skips starting duplicate background processes.
  2. It immediately launches / refocuses the user's browser to `http://127.0.0.1:3000`.
  3. It exits cleanly without port collisions.
- **Foreign Port Conflict Detection:**
  If port 5000 or port 3000 is occupied by an external, non-Archora application, the launcher aborts immediately with an actionable error message informing the user which port is occupied, preventing silent crashes or unexpected behavior.

---

## 6. Unrelated Process Protection (Zero False Positives)

A critical requirement of Phase 12 was: *"Do not terminate unrelated Node.js processes. Check that the process belongs to Archora before stopping it."*

### Implementation & Verification:
1. `stop-archora.ps1` reads recorded PIDs from `%LOCALAPPDATA%\Archora\runtime\archora-pids.json`.
2. For every process targeted, it inspects `Win32_Process` (`CommandLine` and `ExecutablePath`).
3. Only processes whose command line references `Archora`, `tsx server/index.ts`, or `vite` within the Archora directory are terminated.
4. **Automated Verification (Test 5):** An independent, unrelated Node.js background process was spawned during test execution. `stop-archora.ps1` was executed, terminating all Archora processes while leaving the unrelated Node.js process alive and untouched.

---

## 7. Persistent Data Directory Auditing

The setup and startup processes were audited to guarantee that no user data is ever cleared, reset, or stored in temporary build directories:

| Component | Persistent Storage Location | Verification Status |
| :--- | :--- | :--- |
| **SQLite Database** | `%LOCALAPPDATA%\Archora\data\archora.db` | **PRESERVED** (Migration 001-008 applied, zero tables dropped). |
| **Uploaded Drawings & CAD** | `%LOCALAPPDATA%\Archora\uploads\<userId>\` | **PRESERVED** (Stored outside source tree). |
| **Local Backups** | `%LOCALAPPDATA%\Archora\backups\` | **PRESERVED** (Historical ZIP archives intact). |
| **Google Drive Tokens** | Stored in SQLite `google_oauth_tokens` | **PRESERVED** (Encrypted in database). |
| **Environment Configuration** | `D:\Archora\.env` | **PRESERVED** (`setup-archora.bat` never overwrites existing `.env`). |

---

## 8. Automated Windows Deployment Test Suite Results

An automated deployment test runner (`scripts/test-deployment.ps1` / `npm run test:windows`) was developed and executed on the Windows 11 host.

### Test Matrix:
| Test # | Test Case Description | Verified Behavior | Status |
| :---: | :--- | :--- | :---: |
| **1** | **Setup Script Verification** | Verified Node.js (v25.2.1), npm (v11.6.2), `.env` preservation, storage directories, and `npm run build`. | **PASSED** |
| **2** | **Desktop Shortcut & Icon** | Verified `Archora.lnk` on Desktop, pointing to `start-archora.bat` with `arch-icon.ico` and correct working directory. | **PASSED** |
| **3** | **Service Startup & Health** | Verified backend (`127.0.0.1:5000/api/health`) and frontend (`127.0.0.1:3000`) reach readiness within timeout; PIDs recorded in `archora-pids.json`. | **PASSED** |
| **4** | **Duplicate Instance Prevention** | Executed launcher while services were already running. Detected existing services, avoided duplicate spawns, and preserved PIDs. | **PASSED** |
| **5** | **Unrelated Process Protection** | Spawned external dummy Node.js process. Ran `stop-archora.ps1`. Verified external Node process survived untouched. | **PASSED** |
| **6** | **Port Release & Cleanup** | Verified ports 5000 and 3000 were freed completely and `archora-pids.json` was purged. | **PASSED** |
| **7** | **Restart Flow Cycle** | Verified clean stop followed by healthy restart and service readiness. | **PASSED** |
| **8** | **Data Preservation Audit** | Verified `%LOCALAPPDATA%\Archora\data\archora.db` and user storage directories remained untouched across all lifecycle events. | **PASSED** |
| **TOTAL** | **8 Deployment Test Cases** | **Full Windows 11 Lifecycle** | **8 / 8 PASSED (100%)** |

---

## 9. Security & Secret Protection Compliance

- **No Secrets in Output:** `setup-archora.bat` and `start-archora.bat` inspect the Gemini API key and report `[OK] Configured (AQ....8kQ, 53 chars)` without printing the full key.
- **Local Loopback Isolation:** All services are bound strictly to `127.0.0.1`, keeping the studio isolated from external networks.
- **No Administrator Elevation Required:** All setup, startup, shortcut creation, and storage tasks run within standard user privileges (`%LOCALAPPDATA%` and `%USERPROFILE%\Desktop`).
- **No Always-On Daemon:** Archora runs strictly on demand when started by the user and leaves no background daemons running after shutdown.

---

## 10. Summary of Deliverables

1. [start-archora.bat](file:///d:/Archora/start-archora.bat): One-click startup script.
2. [stop-archora.bat](file:///d:/Archora/stop-archora.bat): Safe shutdown script with unrelated process protection.
3. [setup-archora.bat](file:///d:/Archora/setup-archora.bat): One-time automated environment setup.
4. [restart-archora.bat](file:///d:/Archora/restart-archora.bat): Quick service restart utility.
5. [`scripts/setup-archora.ps1`](file:///d:/Archora/scripts/setup-archora.ps1): Environment verification and installer engine.
6. [`scripts/start-archora.ps1`](file:///d:/Archora/scripts/start-archora.ps1): Service launcher, port conflict checker, and PID tracker.
7. [`scripts/stop-archora.ps1`](file:///d:/Archora/scripts/stop-archora.ps1): Targeted process termination engine.
8. [`scripts/create-shortcut.ps1`](file:///d:/Archora/scripts/create-shortcut.ps1): Windows desktop shortcut generator.
9. [`scripts/generateIcon.ps1`](file:///d:/Archora/scripts/generateIcon.ps1): Multi-resolution Windows ICO generator.
10. [`scripts/test-deployment.ps1`](file:///d:/Archora/scripts/test-deployment.ps1): Automated deployment test suite (`npm run test:windows`).
11. [public/arch-icon.ico](file:///d:/Archora/public/arch-icon.ico): High-resolution application icon.
12. [WINDOWS_SETUP_GUIDE.md](file:///d:/Archora/docs/WINDOWS_SETUP_GUIDE.md): Complete user setup and troubleshooting guide.
13. [PHASE_12_WINDOWS_DEPLOYMENT_REPORT.md](file:///d:/Archora/docs/PHASE_12_WINDOWS_DEPLOYMENT_REPORT.md): Final deployment verification report.

---
*Report certified by Archora Windows Deployment & Engineering Team.*


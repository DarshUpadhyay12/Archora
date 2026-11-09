# ARCHORA — GOOGLE DRIVE CLOUD STORAGE INTEGRATION REPORT

**Application:** Archora Architecture Studio  
**Target Google Drive Folder URL:** [https://drive.google.com/drive/folders/1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl](https://drive.google.com/drive/folders/1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl)  
**Target Google Drive Folder ID:** `1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl`  
**Google AI Account Benefit:** Google AI Pro benefit activated via MyJio  
**Operating System:** Windows 11  
**Status:** FULLY INTEGRATED & VERIFIED (106/106 Tests Passing)

---

## 1. Executive Summary

This report documents the implementation of **Google Drive as Archora's Primary Cloud Storage System** and **Website Data Synchronization Provider**.

Archora's storage engine has been transformed to support high-capacity cloud storage while honoring two strict constraints:
1. **Low Local PC Storage Protection (<10 GB Free):** Uploaded architectural files (CAD drawings, high-resolution renders, PDFs, site studies) are uploaded directly to the user's designated Google Drive folder (`1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl`) and automatically unlinked from the local hard drive, leaving only compact SQLite metadata records. Previews and downloads stream directly from Google Drive API with zero permanent local disk footprint.
2. **Strict Zero-Cost Guarantee:** Archora operates completely within free-tier quotas (`drive.file` OAuth scope, free-tier `gemini-3.5-flash-lite` AI model). Absolutely no Google Cloud Billing, credit card activation, or paid API switching is ever triggered.

---

## 2. Google Drive Configuration & Account Integration

- **Designated Destination Folder:** `1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl`
- **OAuth 2.0 Authorization:** Reuses existing Google OAuth integration (`drive.file` scope) with offline access tokens and automatic background refresh.
- **Folder Validation:** Verified automatically upon connection via `googleDriveService.verifyFolder()`:
  - Validates folder existence, type (`application/vnd.google-apps.folder`), active state (not in trash), and write permissions (`capabilities.canAddChildren = true`).
  - Strict destination lock: Backups and primary files target the exact user folder without polluting the user's My Drive root.

---

## 3. Cloud File Storage Architecture

```
+-----------------------------------------------------------------------------------------+
|                               ARCHORA STUDIO FRONTEND                                   |
|   - File Library: Cloud Storage Status Card, Drive Folder Pill, Low-Storage Warnings    |
|   - File Cards / Table: "Drive Cloud" badge, "Open in Google Drive" external link       |
+-----------------------------------------------------------------------------------------+
                                      |
                                      | HTTP API
                                      v
+-----------------------------------------------------------------------------------------+
|                               ARCHORA BACKEND SERVICE                                   |
|                                                                                         |
|  1. Upload Flow (/api/files/upload):                                                    |
|     Multer Disk -> Signature Validation -> GoogleDriveStorageService.uploadProjectFile |
|     -> Pipes stream to Google Drive folder 1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl            |
|     -> Obtains Drive file ID, webViewLink, thumbnailLink, MD5 checksum                  |
|     -> Unlinks local physical file (Low Local Storage Strategy)                         |
|     -> Saves ProjectFileRecord (cloud_storage_status: 'cloud_only') in SQLite           |
|                                                                                         |
|  2. Preview & Download Flow (/api/files/:id/preview & /api/files/:id/download):         |
|     If cloud_only: drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })|
|     -> Pipes stream directly to HTTP Response (0 bytes written to disk)                 |
|                                                                                         |
|  3. Delete Flow (/api/files/:id):                                                       |
|     drive.files.delete({ fileId }) -> Unlinks SQLite record -> Cleans local path        |
+-----------------------------------------------------------------------------------------+
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
+------------------------------------+ +------------------------------------+
|        GOOGLE DRIVE FOLDER         | |         SQLITE DATABASE            |
| 1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl  | | %LOCALAPPDATA%\Archora\data\db     |
| - Large drawings (DWG, DXF)        | | - Projects, Notes, Conversations   |
| - Site analysis & Render images    | | - File metadata & Drive file IDs   |
| - PDF and DOCX presentation sheets | | - Cloud sync state & Offline queue |
| - archora_sync_manifest_v*.json    | | - User settings & Local sessions   |
+------------------------------------+ +------------------------------------+
```

### Supported Architectural File Types:
- **Drawings & CAD:** `.dwg`, `.dxf` (AutoCAD vector drawings)
- **High-Resolution Imagery:** `.jpg`, `.jpeg`, `.png`, `.webp` (Schematic plans, elevations, material palettes)
- **Documents & Presentations:** `.pdf`, `.docx`, `.doc` (Studio jury presentations, structural calculations)

---

## 4. Low Local Storage Strategy (<10 GB PC Storage)

Because the host PC has less than 10 GB of free disk space, Archora implements proactive low-storage safeguards:

1. **Immediate Local Unlinking:** When a file is uploaded while Google Drive is connected, `googleDriveStorageService` uploads the file directly to Google Drive, receives the Drive file ID and links, and immediately calls `removePhysicalFile(localPath)` to unlink the raw file from `%LOCALAPPDATA%\Archora\uploads\`.
2. **On-Demand Streaming:** Previews and downloads stream directly from Google Drive API to Express response buffers, never storing temporary copies on local disk.
3. **Storage Usage Metrics:** Real-time metrics computed via `getStorageOverview(userId)`:
   - **Local Studio Database Size:** Actual disk space used by `archora.db` (typically 1–5 MB).
   - **Google Drive Cloud Storage:** Total bytes and count stored in Google Drive.
   - **Local Disk Space Saved:** Exact byte count freed on the user's hard drive by offloading files to Google Drive.
   - **Host Free Disk Space:** Real-time query of available free bytes on disk via `fs.statfsSync()`.
   - **Low Storage Alert:** Automatically activates if free disk space is under 10 GB.

---

## 5. Website Data Synchronization & Privacy Audit

The data synchronization engine creates clean, versioned manifest snapshots (`archora_sync_manifest_v{version}_{timestamp}.json`) in the designated Drive folder.

### Data Synchronized:
- **Studio Projects:** ID, title, typology, site dimensions, category, descriptions, and architectural requirements.
- **Project Notes:** Chronological field observations, review notes, and structural memos.
- **AI Tutor Conversations:** Multi-turn architectural discussions, topics, and question histories.
- **Saved AI Outputs:** Concept briefs, portfolio narratives, and technical guidelines.
- **Project-File Metadata:** Original filenames, categories, file sizes, Drive file IDs, and cloud links.
- **User Settings:** Parchment warmth, display preferences, and sync configurations.

### Zero-Secret Privacy Guarantee:
The snapshot engine runs a recursive sanitization pass (`sanitizeSyncPayload`) that strictly scrubs:
- `password`, `password_hash`, `salt` (user bcrypt hashes never touch Google Drive)
- `access_token`, `refresh_token`, `token_expiry` (OAuth credentials remain strictly local)
- `gemini_api_key`, `api_key` (AI keys are never serialized)
- `session_token`, `session_id` (Active login sessions remain strictly in local SQLite)

A security assert check verifies that no sensitive credentials exist in the serialized snapshot before upload, throwing a critical error if any sensitive substring is detected.

---

## 6. Offline Resiliency & Synchronization Queue

To handle temporary network disconnections:
1. **Fallback to Local Storage:** If Google Drive is unreachable during file upload, the file is safely stored locally and marked `cloud_storage_status = 'pending_upload'`.
2. **Offline Sync Queue (`offline_sync_queue` table):** Actions (`file_upload`, `file_delete`, `data_sync`) are enqueued with retry counts.
3. **Automatic Replay (`/api/sync/process-queue`):** When network connectivity is re-established, queued uploads and remote deletions are replayed, moving local files to Google Drive and cleaning up local disk space.

---

## 7. Strict Zero-Cost Policy Compliance

Archora's Google Drive integration complies with the application-wide Strict Zero-Cost Policy:
- **Standard OAuth 2.0 Quota:** Utilizes the generous free Google Drive API tier (up to 1,000,000,000 requests/day per project).
- **No Google Cloud Billing:** Zero billing accounts, credit cards, or paid service dependencies.
- **Billing Interception:** If Google ever returns a `billingNotEnabled` or billing-related 403 error, the system catches it, disables cloud backups/uploads gracefully, and informs the user while keeping 100% of local studio operations active and free.
- **Gemini Free-Tier Lock:** AI features remain strictly bound to the free model `gemini-3.5-flash-lite`.

---

## 8. Verification & Test Results

### Automated Test Suite:
All 10 test suites in Archora pass with 100% success rate:

```
Test Suite Breakdown:
1.  server/tests/dbIntegration.test.ts          - 12 Tests PASSED
2.  server/tests/aiHistory.test.ts              -  8 Tests PASSED
3.  server/tests/fileManagement.test.ts         - 12 Tests PASSED
4.  server/tests/pdfExport.test.ts              - 11 Tests PASSED
5.  server/tests/aiUsage.test.ts                - 10 Tests PASSED
6.  server/tests/backupRestore.test.ts          - 15 Tests PASSED
7.  server/tests/googleDrive.test.ts            - 15 Tests PASSED
8.  server/tests/googleDriveStorage.test.ts     -  7 Tests PASSED
9.  server/tests/securityAndE2E.test.ts         - 11 Tests PASSED
10. server/tests/zeroCostPolicy.test.ts         -  5 Tests PASSED
-------------------------------------------------------------------
Total Automated Test Suites:                    10/10 PASSED (106 tests)
Windows Deployment Test Suite (npm run test:windows):  8/8 PASSED
Frontend Build (tsc -b && vite build):                 SUCCESS (0 errors)
```

### Verified Scenarios in `googleDriveStorage.test.ts`:
1. Default Google Drive folder verified strictly as `1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl`.
2. Low local storage strategy unlinks local raw files and persists `cloud_only` metadata.
3. Storage usage summary accurately computes cloud storage used and local bytes saved.
4. Website data snapshot generation audited with 100% absence of passwords, bcrypt hashes, API keys, and OAuth tokens.
5. Snapshot data restoration merges cleanly into studio databases without foreign-key conflicts.
6. Offline sync queue correctly enqueues, retries, and resolves pending cloud actions.
7. Format bytes utility verified across byte, KB, MB, and GB scales.

---

## 9. Conclusion

Google Drive is now Archora's primary cloud storage system. The user's Google AI Pro storage benefit is utilized to store large architectural drawings in folder `1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl`, protecting the user's local disk (<10 GB free) while maintaining studio autonomy, zero secret leakage, and strict zero-cost operation.


# ARCHORA — STRICT ZERO-COST POLICY

**Status:** ACTIVE & STRICTLY ENFORCED  
**Policy Version:** 1.0.0  
**Effective Date:** November 2, 2026  
**Applicability:** Entire Codebase, Server APIs, Frontend UI, Deployment Scripts & Cloud Integrations  

---

## 1. Core Principle: Zero Charges, Zero Payment Activation

Archora is designed, engineered, and maintained as a **100% free architectural studio workspace**. 

Under no circumstances will Archora ever:
- Require, request, or configure a credit or debit card.
- Enable or require Google Cloud Billing.
- Create a paid Google Cloud account.
- Activate paid APIs, paid add-ons, or subscription services.
- Call paid AI models (e.g., Gemini Pro, Gemini Ultra, GPT-4, Claude Opus).
- Automatically fall back to paid models or paid tiers when free quotas are exhausted.
- Subscribe to paid cloud hosting, paid managed databases, or paid storage buckets.
- Make any network or API call that can generate unexpected financial charges.

Every feature in Archora operates either:
1. **Locally on your machine** (zero cloud dependency, zero internet required), or
2. **Via verified, permanent free-tier quotas** that function without entering payment information.

---

## 2. Google Gemini AI Free-Tier Rules

### Approved Free-Tier Models
Archora strictly restricts AI generation to Google's free-tier models on Google AI Studio:
- **Default Active Model:** `gemini-3.5-flash-lite` (Free Tier)
- **Whitelisted Alternatives:** `gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-1.5-flash`, `gemini-1.5-flash-8b`

### Paid Model Prohibition
In `server/services/geminiService.ts`, the whitelist `ALLOWED_FREE_TIER_MODELS` is enforced at initialization time:
- If any configuration attempts to specify a paid model (e.g. `gemini-1.5-pro`, `gemini-2.5-pro`, or any model containing `pro` or `ultra`), **Archora blocks the request and automatically overrides the model to the free-tier `gemini-3.5-flash-lite`**.
- This programmatic override prevents accidental charges even if an unsupported model string is provided in `.env`.

### Quota Exhaustion (HTTP 429) Behavior — Zero Paid Fallback
When Google's free-tier rate limit or daily quota is reached:
1. **Requests Are Immediately Paused:** Archora catches the HTTP 429 `RESOURCE_EXHAUSTED` error.
2. **Clear User Notification:** The student is presented with an explicit notification:
   > *"Free-tier Gemini quota temporarily exhausted (HTTP 429). In accordance with Archora's Strict Zero-Cost Policy, AI requests have been paused until the free quota window resets. No paid models or billing will ever be invoked. Please retry in a few moments."*
3. **No Automatic Fallbacks:** Archora **never** switches to a paid model or alternate paid API. The system simply waits for Google's free quota window to refresh (typically within 60 seconds for minute rate limits or at midnight UTC for daily quotas).

---

## 3. Google Drive Integration Free-Tier Rules

Google provides generous free-tier quotas for personal and educational Google accounts:
- **Drive API Standard Quota:** Up to 1,000,000,000 requests per day via standard OAuth 2.0 Client credentials without requiring a Google Cloud billing account.
- **Dedicated Folder:** Backups are restricted strictly to the user's existing Google Drive folder (`1hTYk7StoL5GsRpitJyAwdaVf_ivleUWl`) using the minimal `drive.file` scope.

### Automatic Disablement if Billing is Requested
If Google Cloud ever flags a project as requiring billing activation (e.g. `billingNotEnabled` or 403 billing requirement):
1. **Cloud Upload Aborts Immediately:** Archora instantly stops the remote transfer before any billing condition can occur.
2. **Graceful Disablement:** The Google Drive folder status is marked as disabled.
3. **User Notification:** Archora explains:
   > *"Google Cloud billing is required by this project. In adherence to Archora's Strict Zero-Cost Policy, cloud backups are automatically disabled to prevent any unexpected charges. Local Backup & Restore is 100% free and fully functional."*
4. **Local Backup Remains 100% Operational:** Local `.zip` backup generation, pre-restore snapshots, and vector PDF exports continue working without interruption.

---

## 4. Local Autonomous Capabilities (Always 100% Free)

Every essential architectural feature in Archora has a fully functional, offline, local alternative that requires zero internet connection, zero API keys, and zero payment:

| Feature | Cloud / AI Method (Free Tier) | Autonomous Local Alternative (100% Offline & Free) |
| :--- | :--- | :--- |
| **Studio Projects & Notes** | Synced in local SQLite | `%LOCALAPPDATA%\Archora\data\archora.db` (Local SQLite WAL database) |
| **Drawing & File Management** | Local disk storage | `%LOCALAPPDATA%\Archora\uploads\` (Isolated local folder on your drive) |
| **Backup & Recovery** | Google Drive Cloud Backup | Local atomic `.zip` archives with SHA-256 checksums in `%LOCALAPPDATA%\Archora\backups\` |
| **Architectural Reports** | AI-assisted commentary | Native Vector PDF export engine (`pdfkit`) running entirely on local CPU |
| **Architecture Learning** | Architecture Tutor (Gemini) | Project Library, historical precedents, and student note system |

---

## 5. Security & Billing Audit Check

The Archora codebase undergoes continuous automated auditing against billing leaks:
- **No Payment Gateways:** Zero integration with Stripe, PayPal, LemonSqueezy, or payment processors.
- **No Billing Environment Variables:** `.env` and `.env.example` contain zero fields for credit cards, billing IDs, or paid platform keys.
- **Automated Verification:** Verified via `server/tests/zeroCostPolicy.test.ts` (included in standard `npm test`).

---
*Policy certified and enforced by Archora Architecture Studio.*


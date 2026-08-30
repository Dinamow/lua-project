# HR Assistant — Lua Take-Home (Leave Management + Daily Performance Management)

A bilingual (Arabic/English) HR agent built on Lua for a fictional 50,000-employee
KSA-headquartered conglomerate (KSA/UAE/Egypt/Jordan). Built for the Lua
Implementation Engineer take-home.

## What's implemented

| Task requirement | Where |
|---|---|
| Leave Management workflow | [`src/skills/leaveManagement.skill.ts`](src/skills/leaveManagement.skill.ts) + its tools |
| Daily Performance Management workflow | [`src/skills/performanceManagement.skill.ts`](src/skills/performanceManagement.skill.ts) + its tools |
| BambooHR API integration | [`src/services/bambooHR.service.ts`](src/services/bambooHR.service.ts) — via Lua's `Integrations.passthrough('bamboohr', …)`, with a mock-data fallback so the agent still works before a live BambooHR connection exists. Verified live against a real BambooHR trial company. |
| Google Sheets API integration | [`src/services/googleSheets.service.ts`](src/services/googleSheets.service.ts) — direct Sheets REST calls with a hand-signed service-account JWT (see why in the file reference below). Verified live, read + write. |
| Gratuity calculation | [`src/services/gratuity.ts`](src/services/gratuity.ts) — exact KSA statutory formula, simplified approximation for UAE/Egypt/Jordan |
| Iqama expiry alerts | [`src/jobs/iqamaExpiryAlert.job.ts`](src/jobs/iqamaExpiryAlert.job.ts) (daily cron) + [`CheckIqamaExpiryTool`](src/skills/tools/CheckIqamaExpiryTool.ts) (on-demand) |
| Knowledge base (mock HR policies/SOPs) | [`kb/`](kb) — upload via `lua resources`, then `lua features enable --feature-name rag` |
| Bilingual AR/EN | Handled by persona instructions in [`src/index.ts`](src/index.ts), not a separate i18n layer — the LLM detects and mirrors the user's language |
| Web portal + WhatsApp | `lua channels` (see Setup below) |

Onboarding and SOP Requests were **not** built — Leave Management + Daily
Performance Management were chosen because together they exercise both
mandatory integrations (BambooHR + Google Sheets).

## Project structure & file reference

```
src/
  index.ts                          agent definition: persona, skills, jobs
  skills/
    leaveManagement.skill.ts        balance check → entitlement → submit → approve
    performanceManagement.skill.ts  daily check-in → weekly summary
    hrCore.skill.ts                 gratuity, Iqama lookup, mock-data seeding
    tools/                          one LuaTool per action
  services/                         plain TypeScript, no Lua-specific API — easy to unit test
    bambooHR.service.ts             BambooHR via Integrations.passthrough (+ mock fallback)
    googleSheets.service.ts         Sheets via a hand-signed service-account JWT + axios
    leaveRules.ts / gratuity.ts     pure country-specific rule engines
    mockEmployees.ts                seed data / BambooHR fallback data
  jobs/
    iqamaExpiryAlert.job.ts         daily cron, proactive WhatsApp alerts via Channels.send
kb/                                 mock HR policy/SOP docs for the knowledge base
```

### Entry point

| File | Purpose |
|---|---|
| [`src/index.ts`](src/index.ts) | Defines the agent: name, bilingual persona/system prompt (identity, business context, capabilities, boundaries, guidelines), which skills and jobs are registered, and the model (`google/gemini-2.5-flash`). This is what `lua push` / `lua chat` actually run. |

### Skills

Each skill bundles a set of tools plus `context` — extra instructions injected for the LLM on when/how to use them.

#### `leave-management-skill` — [`src/skills/leaveManagement.skill.ts`](src/skills/leaveManagement.skill.ts)

Full leave lifecycle: balance check → entitlement explanation → submission → manager approval.

| Tool | File | Purpose |
|---|---|---|
| `check_leave_balance` | [`CheckLeaveBalanceTool.ts`](src/skills/tools/CheckLeaveBalanceTool.ts) | Looks up an employee via `BambooHRService` (id or email) and returns country, tenure, and their live time-off balances per leave type. |
| `calculate_leave_entitlement` | [`CalculateLeaveEntitlementTool.ts`](src/skills/tools/CalculateLeaveEntitlementTool.ts) | Given country + leave type (`annual`/`sick`/`emergency`) + tenure, returns the statutory yearly entitlement. Thin wrapper around `getEntitlement()` in `leaveRules.ts`. |
| `submit_leave_request` | [`SubmitLeaveRequestTool.ts`](src/skills/tools/SubmitLeaveRequestTool.ts) | Validates the requested days against the live balance for whatever leave type BambooHR actually has configured, computes entitlement context only when the country/leave-type combination is one this demo models, creates the request in BambooHR (using the real numeric `timeOffTypeId`), stores it as `pending` in Lua's Data store, and WhatsApps the line manager for approval. |
| `record_approval_decision` | [`RecordApprovalDecisionTool.ts`](src/skills/tools/RecordApprovalDecisionTool.ts) | Called when a manager replies "approve/reject `<requestId>`" — updates the stored request's status and notifies the employee of the outcome over WhatsApp. |

#### `performance-management-skill` — [`src/skills/performanceManagement.skill.ts`](src/skills/performanceManagement.skill.ts)

Daily check-ins and weekly rollups, backed by a live Google Sheet.

| Tool | File | Purpose |
|---|---|---|
| `record_daily_checkin` | [`RecordDailyCheckinTool.ts`](src/skills/tools/RecordDailyCheckinTool.ts) | Appends one row (date, team lead, team member, accomplishments, blockers, 1-5 rating) to the sheet's "Checkins" tab, creating the tab and header row first if they don't exist yet. |
| `get_weekly_summary` | [`GetWeeklySummaryTool.ts`](src/skills/tools/GetWeeklySummaryTool.ts) | Reads a team lead's rows for a given week (default: current Sun–Sat), aggregates per-member average rating, blockers, and accomplishments for the agent to narrate in natural language. |

#### `hr-core-skill` — [`src/skills/hrCore.skill.ts`](src/skills/hrCore.skill.ts)

Cross-cutting utilities not tied to either workflow above.

| Tool | File | Purpose |
|---|---|---|
| `calculate_gratuity` | [`CalculateGratuityTool.ts`](src/skills/tools/CalculateGratuityTool.ts) | End-of-service gratuity — exact KSA statutory formula (Articles 84–87, with resignation proration), simplified 1-month-per-year approximation for UAE/Egypt/Jordan. Wraps `calculateGratuity()` in `gratuity.ts`. |
| `check_iqama_expiry` | [`CheckIqamaExpiryTool.ts`](src/skills/tools/CheckIqamaExpiryTool.ts) | Residency-permit expiry lookup for a KSA employee, read from the seeded mock directory (real BambooHR trial companies don't have this as a configured custom field). Flags urgency as `ok`/`warning`/`critical` based on days remaining. |
| `seed_mock_data` | [`SeedMockDataTool.ts`](src/skills/tools/SeedMockDataTool.ts) | One-time setup tool — populates the `employees` Data collection from `mockEmployees.ts`. Idempotent (skips if records already exist) unless called with `force: true`. |

### Jobs

| File | Purpose |
|---|---|
| [`src/jobs/iqamaExpiryAlert.job.ts`](src/jobs/iqamaExpiryAlert.job.ts) | Cron job, daily at 7am Asia/Riyadh. Scans every seeded employee for an Iqama expiring at exactly the 30/14/7-day mark and proactively WhatsApps both the employee and their line manager. |

### Services

Plain TypeScript with no Lua-specific API surface — easy to read and unit-test in isolation from the agent runtime.

| File | Purpose |
|---|---|
| [`src/services/bambooHR.service.ts`](src/services/bambooHR.service.ts) | All BambooHR access, via `Integrations.passthrough('bamboohr', …)`: `getEmployee`, `getTimeOffBalances`, `createTimeOffRequest`. Explicitly sends `Accept: application/json` on every call — BambooHR's v1 API returns XML by default otherwise. Falls back to the mock employee directory whenever the integration isn't connected or a lookup 404s, so the rest of the agent still works end-to-end without a live connection. |
| [`src/services/googleSheets.service.ts`](src/services/googleSheets.service.ts) | Talks to the Sheets REST API directly with a service account. Signs its own JWT-bearer assertion by hand with Node's built-in `crypto` (RS256) and exchanges it for a token via a plain `axios.post` — deliberately avoids `google-auth-library`, whose HTTP client (`gaxios`) depends on a global `ReadableStream` that Lua's sandboxed tool runtime doesn't provide. |
| [`src/services/leaveRules.ts`](src/services/leaveRules.ts) | Country-specific annual/sick/emergency entitlement rules for KSA/UAE/Egypt/Jordan, each citing the labour-law article it approximates. Also exports `isSupportedCountry()` and `inferEntitlementLeaveType()`, used by `submit_leave_request` to skip the entitlement calculation gracefully for employees or leave types outside this demo's modeled scope, instead of throwing. |
| [`src/services/gratuity.ts`](src/services/gratuity.ts) | End-of-service gratuity math — exact KSA formula (Articles 84–87), simplified 1-month-per-year approximation for the other three countries. |
| [`src/services/mockEmployees.ts`](src/services/mockEmployees.ts) | Hardcoded directory of 6 demo employees spanning all 4 countries. Doubles as the BambooHR fallback data and the Iqama-alert job's seed data. |

### Knowledge base — [`kb/`](kb)

Uploaded via `lua resources`, searchable once the `rag` feature is enabled. Backs general policy questions the agent can answer directly rather than via a tool call.

| File | Purpose |
|---|---|
| [`kb/labour-law-and-probation.md`](kb/labour-law-and-probation.md) | Overview of probation periods and labour-law basics across the 4 countries. |
| [`kb/sop-transfer-request.md`](kb/sop-transfer-request.md) | Mock SOP for internal transfer requests. |
| [`kb/sop-salary-certificate.md`](kb/sop-salary-certificate.md) | Mock SOP for salary certificate issuance. |
| [`kb/sop-housing-allowance.md`](kb/sop-housing-allowance.md) | Mock SOP for the housing allowance policy. |
| [`kb/sop-exit-reentry-visa.md`](kb/sop-exit-reentry-visa.md) | Mock SOP for the KSA exit/re-entry visa process. |

### Configuration & project files

| File | Purpose |
|---|---|
| [`lua.skill.yaml`](lua.skill.yaml) | Lua's manifest linking this repo to the deployed agent/skills/job ids. Generated and kept in sync by the CLI on every `lua push`/`lua test` — not meant to be hand-edited. |
| [`package.json`](package.json) | Dependencies and scripts (`dev`, `build`, `format`). Runs on `tsx`; TypeScript throughout. |
| [`tsconfig.json`](tsconfig.json) | TypeScript compiler configuration. |
| [`env.example`](env.example) | Documents the required env vars for Google Sheets, and clarifies that BambooHR auth is configured via `lua integrations connect` (Lua's credential vault), not a `.env` variable. |
| [`QUICKSTART.md`](QUICKSTART.md) | Condensed version of the Setup steps below, for a fast first run. |

## Architecture

Lua is an Agent OS: skills/tools run as TypeScript on Lua's own infra, so there's no separate backend service to deploy or host — this repo *is* the deployable unit.

Manager approval routing uses Lua's `Channels.send` to message the line
manager directly (by phone number from BambooHR), asking them to reply
`approve <requestId>` / `reject <requestId>`; the agent's persona instructs it
to call `record_approval_decision` when it sees that pattern.

## Setup

1. **Install dependencies**
   ```bash
   yarn install
   ```

2. **BambooHR** — connect the integration (stores the API key in Lua's vault, this code never sees it):
   ```bash
   lua integrations connect --integration bamboohr --auth-method token
   ```
   You'll be prompted for a BambooHR **API Key** (generate one from your BambooHR account: your name menu → API Keys) and your company **subdomain**. The connecting user/API key's BambooHR Access Level needs at least View access to Employee, Payroll (compensation), Time Off, and Time Tracking — Unified.to's setup check reads across all of those. Until connected, `BambooHRService` transparently falls back to the mock employee directory in `src/services/mockEmployees.ts`, so everything still works for a demo.

3. **Google Sheets** — create a service account with the Sheets API enabled, share a sheet with it as an Editor, then:
   ```bash
   lua env sandbox -k GOOGLE_SERVICE_ACCOUNT_EMAIL -v "..."
   lua env sandbox -k GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY -v "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   lua env sandbox -k GOOGLE_SHEET_ID -v "..."
   ```
   See `env.example` for the exact format. Repeat with `lua env production -k ... -v ...` before deploying.

4. **Knowledge base** — upload each file in `kb/` via `lua resources`, then:
   ```bash
   lua features enable --feature-name rag
   ```

5. **Seed mock employee data** (needed for Iqama alerts / BambooHR fallback):
   ```bash
   lua test skill --name seed_mock_data --input '{}'
   ```

6. **Test**
   ```bash
   lua test    # test individual tools
   lua chat    # converse with the agent — try both Arabic and English
   ```

7. **Deploy + channels**
   ```bash
   lua push all --force --auto-deploy
   lua channels   # set up the web widget + WhatsApp (needs a Meta Business/WABA account)
   ```

## Known simplifications

- Leave entitlement and gratuity figures are simplified approximations of KSA/UAE/Egypt/Jordan labour law for demo purposes, not legal advice — see the comments in `leaveRules.ts` and `gratuity.ts` for exactly what's simplified.
- `submit_leave_request` accepts whatever leave-type labels a connected BambooHR company actually has configured (e.g. "Bereavement", "In Lieu Time"), but the yearly-entitlement figure is only computed for types that map to this demo's modeled annual/sick concepts, and only for the 4 modeled countries — other combinations still get a balance check, just without an entitlement line.
- Iqama expiry data lives in the mock employee directory rather than a BambooHR custom field, since a fresh BambooHR trial company won't have one configured.
- Manager approval is a plain-text reply pattern (`approve <id>` / `reject <id>`) rather than a dedicated UI — enough to demonstrate the round trip within the take-home's scope.

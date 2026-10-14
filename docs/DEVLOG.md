# WUPCare Development Log

Records the technology stack, iteration dates, completed features, and tests, as required by Paper §3.D.

## Stack

| Item | Version |
|---|---|
| Node.js | 24.19.0 |
| Next.js (App Router, Turbopack) | 16.4.0 |
| React | 19.3.0 |
| TypeScript | 5 (strict) |
| Tailwind CSS | 4 |
| shadcn/ui | radix-nova style, Radix base |
| @supabase/supabase-js | 2.117.3 |
| @supabase/ssr | 0.12.7 |
| zod | 4.6.7 |

## Phase 1: Project setup and authentication — 2026-10-14

### Completed
- Removed `cacheComponents` and `partialPrefetching` from `next.config.ts` (decision 2).
- shadcn/ui initialized. Components: button, input, label, alert, sheet, separator, badge.
- Design tokens: deep green accent, green-tinted neutrals, status colors, light theme only.
- Supabase clients: server, browser, admin (server-only), session proxy helper.
- `proxy.ts`: refreshes the session; redirects signed-out users to `/login`.
- Data Access Layer (`lib/auth/dal.ts`): `getAuthState()` and `requireRole()`. Role comes from `public.profiles`. Denies by default.
- Login page (email and password), logout, blocked-account notice, missing-config notice.
- Role layouts: clinic shell (administrator, clinic personnel) with sidebar and mobile sheet; student portal shell.
- Dashboard placeholders for each role.

### Tests
| Test | Result |
|---|---|
| `tsc --noEmit` | Pass |
| `npm run lint` | Pass (0 errors; 5 warnings in `.pixel-agents/`, not app code) |
| `npm run build` | Pass. All auth routes are dynamic (`ƒ`). |
| Signed out: `/`, `/dashboard`, `/portal`, `/students`, `/admin/users` | 307 to `/login` |
| Forged session cookie on `/dashboard` | 307 to `/login` |
| `/login` desktop and 500px width | Renders; config notice shown; form disabled |

### Blocked until Phase 2
- No user can get past login: `public.profiles` does not exist, so every signed-in user is shown "Your account is not set up yet".
- Role routing, dashboards, and sidebars could not be tested signed in.
- No Supabase project for WUPCare is configured in `.env.local`.

## Phase 2: Database schema and RLS — 2026-10-14 (database complete; self-registration pending decision)

Target: Supabase project "Research" (`rlpppneoxsbebathqzfw`), Postgres 17.

### Applied migrations
| Version | Name | Result |
|---|---|---|
| 20261014112222 | 0001_enums | Applied. 5 enums, `private` schema (no anon access). |
| 20261014112305 | 0002_tables | Applied. 10 tables, RLS on all, default anon/authenticated grants revoked. |
| 20261014112330 | 0003_helpers | Applied. 8 private functions, 10 triggers, `on_auth_user_created`. |
| 20261014112410 | 0004_inventory | Applied. 5 inventory/save RPCs; `issue_items` not callable by clients. |
| 20261014112431 | 0005_appointments | Applied. |
| 20261014112454 | 0006_rls | Applied. 21 policies, 0 anon grants, 0 DELETE grants. |
| 20261014112528 | 0007_reports | Applied. |
| 20261014112539 | 0008_reference_data | Applied. 10 concern categories, default clinic hours. |
| (applied) | 0009_fix_auth_provisioning | Applied after approval. Trigger now `AFTER INSERT OR UPDATE OF raw_app_meta_data`. |

Post-apply checks: 26 functions in `public`/`private`, all with `search_path = ''`; none executable by `anon`; 27 foreign keys. `types/database.ts` generated from the live schema.

### Advisors
- Security: 12 × WARN `0029 authenticated_security_definer_function_executable`. Intentional: the 5 inventory/save RPCs, 5 reports, and 2 admin linking functions. Each checks the caller's role first; none is executable by `anon`. No ERROR-level findings.
- Performance: INFO only. 18 unindexed foreign keys (audit columns such as `updated_by`, `attended_by`, and composite same-student keys); 16 unused indexes (database is empty). No action for now.

### Live verification (real Auth users, real JWTs, PostgREST, `next start`)
Temporary fictional accounts `p2test-*@wupcare.test` were created with the Auth Admin API and deleted afterwards. All test rows were removed. 0 auth users and 0 data rows remain (reference data kept).

Passed live:
- `anon` gets `42501` on all tables and RPCs.
- The `private` schema is not exposed through the Data API (`PGRST106 Invalid schema: private`) for anon and signed-in users.
- Admin and student JWTs read 0 rows from `students`, `health_records`, `clinic_visits`, `health_incidents`, `medication_transactions`, and `medicines`.
- Nobody can insert a profile. A role in `user_metadata` is ignored.
- An unprovisioned JWT reads nothing and cannot run reports.
- Clinic staff can't set `is_demo`, write stock directly, write the ledger, or delete students.

**Failed live: account provisioning (defect found).**
Supabase Auth's admin `createUser` inserts `auth.users` with default `app_metadata`, then writes the custom `app_metadata` in a separate UPDATE. Evidence: `updated_at` is 22 ms after `created_at`, and the stored `app_metadata` has `wupcare_role`, but no profile exists. The 0003 `AFTER INSERT` trigger never saw the role, so:
- no profiles were created;
- an invalid role was not rejected;
- every role-dependent live test (clinic staff, student, admin reports, deactivation, app redirects) could not run.

The PGlite offline suite did not catch this, because it inserted `app_metadata` in one statement. This is the item flagged earlier as "needs live verification."

Fix: `0009_fix_auth_provisioning.sql` also fires the trigger on `UPDATE OF raw_app_meta_data`. It creates the profile only if none exists (`on conflict (id) do nothing`), so it never changes an existing role. Offline suite: 137/137 pass, including the GoTrue insert-then-update sequence.

### Build checks
| Check | Result |
|---|---|
| `tsc --noEmit` | Pass |
| `npm run lint` | Pass (0 errors; 5 warnings in `.pixel-agents/`, not app code) |
| `npm run build` | Pass |

### Live re-test after 0009 — 107/107 passed
Run with temporary fictional accounts (`p2test-*@wupcare.test`), real sign-ins, PostgREST, and `next start`.

| Area | Result |
|---|---|
| Provisioning | The trigger creates admin, clinic staff, and student profiles from `app_metadata`. An invalid role and a second account for an already-linked student both fail `createUser` ("Database error creating new user"), and **no orphan auth user is left** (same transaction). |
| Escalation | A role in `user_metadata` is ignored. A signed-in user calling `updateUser({ data: { wupcare_role: "admin" } })` gets no profile and cannot write `app_metadata`. No one can insert a profile. Admins cannot demote or deactivate themselves. |
| Anon / Data API | `42501` on all tables and RPCs. `private` schema not exposed (`PGRST106`). |
| Role isolation | Admin and student read 0 rows from all clinical tables. A student sees only their own profile and appointments. Admin linking functions return only id, number, and name. |
| Inventory | Restock and adjust work, and adjusting below zero is rejected. Direct stock and ledger writes are denied. A visit with 2+1 of the same medicine saves; an over-issue rolls back the whole visit (stock unchanged, ledger sum = stock). `attended_by` is forced to the caller. The same-student foreign key holds. An incident with medication saves. |
| Appointments | Clinic hours, Sunday, self-approve, and another-student requests are rejected. One pending request per student (`appointments_one_pending_per_student`). Approve, reschedule (count + 1), complete, and the declined-needs-remark rule all work. A student can cancel their own pending request only. |
| Reports | Staff get exact counts. An admin's per-day request is refused; admin counts below 5 return null. Students are refused. |
| Deactivation | An inactive student or clinic staff member gets 0 rows and "Not allowed." An Auth ban blocks sign-in ("User is banned"). |
| Routing | Signed out → `/login`. Admin and clinic staff → `/dashboard`, student → `/portal`, with cross-role pages redirected. Inactive and unprovisioned users → `/login`. After sign-out → `/login`. |

Residual data after cleanup: 0 auth users, 0 identities, 0 rows in all data tables. Reference data remains: 10 categories, 1 `clinic_settings` row (unchanged, `updated_by` null).

Security advisor after 0009: unchanged (12 intentional `0029` WARNs, no ERROR).

Build checks after 0009: `tsc` pass, lint 0 errors (5 warnings in `.pixel-agents/`), `npm run build` pass.

### Open items
- **Student self-registration:** approved design (Supabase Auth only, clinic staff approve the link). SYSTEM_SPEC.md and PLAN.md updated to v2.1. `0010_student_self_registration.sql` prepared and tested offline (PGlite 160/160, including sign-up before and after confirmation, a forged role in `user_metadata`, admin `createUser` with `email_confirm`, pending-account isolation, and approval rules). **Not applied.**
- Email delivery for real students (spec Q-A1): the built-in email service delivers only to the Supabase organization's team members.
- Auth settings for self-registration (sign-ups on, "Confirm email" on, redirect URLs): not changed; needs approval.
- First administrator: manual dashboard step (docs/AUTH_PROVISIONING.md §4). Not done.
- Service-role key rotation: deferred by the client, risk acknowledged.

## Development accounts and demo data (2026-10-14)
For development, fictional accounts were created through the Auth Admin API: `dev-admin@wupcare.test`, `dev-nurse@wupcare.test`, and `dev-student@wupcare.test` (the last linked to `DEMO-0001`). Passwords are random and kept only on the developer machine, outside the repository. A minimal demo dataset was added: 4 students `DEMO-0001`–`DEMO-0004` and 5 medicines (one low on stock, one expired), all with `is_demo = true` and fictional data. Starting stock is recorded as restock rows in the stock ledger. The Phase 8 seed will replace this data.

Testing: end-to-end tests drive the installed Microsoft Edge through `playwright-core`, installed outside the project, so no project dependency was added. They run against `next build` + `next start`. Test rows use the `E2E-` prefix.

## Phase 3: Student and health records — 2026-10-14
- Shared building blocks: typed Supabase clients (`types/database.ts`); Manila-time formatting helpers; `FormState` + zod `parseForm`; safe database error messages (`lib/db-errors.ts`); labeled fields with inline errors; native select, textarea, and table components; filters that work as plain GET forms; pagination (25 rows); link-based tabs; status and DEMO badges. The sidebar now enables all modules, shows the pending-appointment count, and is hidden when printing. The clinic layout gained a `<main>` landmark.
- `/students`: search by number or name, plus filters for college, year, status, and Real/Demo/All.
- `/students/new` and `/students/[id]/edit`: validation, a field error for a duplicate number, and the `DEMO-` prefix blocked on new records. Archiving is done by setting the status to Inactive or Graduated.
- `/students/[id]`: header with DEMO and status badges and allergy/condition alerts. Tabs: Health record, Visits, Appointments, Incidents, Medications. Quick actions: new visit, book appointment, record incident, history report.
- `/students/[id]/health/edit`: shows who last updated the record and when.
- E2E: **27/27 passed**. Covered list and filters, create with validation, typed values kept after an error, duplicate and `DEMO-` rejection, edit, health record editing with the "updated by" line, all tabs, 404, admin and student redirects, and 360px layouts.

## Phase 4: Clinic visits — 2026-10-14
- `/visits/new`: student picker (GET search), allergy alert, DFD 3.1–3.4 fields, concern category, and repeatable medication rows listing only active, unexpired, in-stock medicines that match the student's demo/real side. Saves through `create_visit_with_medications` (one transaction). Can link a completed appointment (`?appointment=`).
- `/visits`: log with student search, date range, concern, and scope filters.
- `/visits/[id]`: detail, read-only issued medicines, related incidents, "last edited by".
- `/visits/[id]/edit`: corrections. Issued medicines can't be changed here; stock is corrected by an adjustment.
- E2E: **19/19 passed**. Covered the allergy alert, the medicine list (expired medicine hidden), required fields, a rejected over-issue that saved nothing (other stock unchanged), a visit with 2 tablets (stock 50 → 48), the edit audit line, the log filters, the student history and medications tabs, admin blocked, and 360px layout.

## Phase 5: Appointments, medication inventory, clinic hours — 2026-10-14
- `/settings/clinic-hours`: open days, opening and closing time, days ahead. Validated in the form and in the database. Shows who last changed it.
- Student portal:
  - `/portal`: own appointments with status, schedule, staff remarks, and a reschedule note.
  - Students can cancel a pending request.
  - Requesting is blocked while a request is pending; the database also enforces this with the one-pending index.
  - Shows "Waiting for clinic approval" if the account has no student link.
- `/portal/request`: date and time limited to the clinic hours. The database rejects anything outside them.
- Staff:
  - `/appointments`: views Pending, Today, Upcoming, Completed, Declined, Cancelled, and All, with student, date, and scope filters. The pending count shows in the sidebar.
  - `/appointments/[id]`: approve with a schedule; decline (remark required); reschedule (remark required; the database counts reschedules); cancel; complete. A completed appointment offers "Record visit" with the link pre-filled.
  - `/appointments/new`: staff booking, saved as approved.
- Medications:
  - `/medications`: stock, reorder level, expiry, and Low / Expiring (30 days) / Expired / Inactive flags, plus filters.
  - `/medications/new`: starting stock is saved as a restock row.
  - `/medications/[id]`: issue to a student by student number, restock, adjust (reason required), transaction history, ledger check, deactivate or reactivate.
  - `/medications/[id]/edit`.
- `ActionForm`: inline action form that keeps typed values when the server returns an error and shows field messages in its alert.
- E2E: **44/44 passed** (after fixing ActionForm error display). Covered:
  - clinic hours: validation and save, after which the request form and the database both follow the new closing time;
  - portal: request, pending block, cancel, re-request;
  - staff: queue and sidebar count, approve, reschedule (remark required, count 1, student sees the remark), complete → record visit → visit linked, decline (remark required) visible to the student, staff booking;
  - inventory: flags and filters, new medicine with starting stock, restock, adjust (negative rejected, values kept), issue (demo/real mismatch, stock limit, and unknown number all blocked), edit, deactivate/reactivate, expired medicine blocked;
  - role redirects and 360px layouts.
- Database check: stock equals the ledger sum for all 7 medicines.

## Phase 6: Health incidents — 2026-10-14
- `/incidents/new`: student picker, allergy alert, type, date and time, location, description, action taken, an optional link to one of the student's visits, and optional medication rows. Saves through `create_incident_with_medications` (one transaction).
- `/incidents`: log with student, type, date range, and scope filters.
- `/incidents/[id]`: detail with medication given, the related visit, and recorded/edited by.
- `/incidents/[id]/edit`: corrections.
- Linked records show up where they belong: the visit page lists related incidents, and the medicine history links to the incident.
- E2E: **18/18 passed**. Covered required fields, a rejected over-issue that saved nothing, a saved incident with medication (stock 20 → 19) and visit link, the cross-links, edit with audit line, type and scope filters, student history, admin blocked, and 360px layout.

## Phase 7: Reports and administration — 2026-10-14
- `/reports` (administrators and clinic personnel): clinic visits per day or month, common health concerns, medication usage plus current stock, incidents per type, and appointments per status. Each has a date range and a Real (default) / Demo / All scope, uses the `report_*` functions, and has a print-friendly layout with a report header (the app shell is hidden when printing). Administrators see whole months only and "<5" for small counts (FR-RPT-3a), with an explanatory note.
- `/reports/student/[id]` (clinic personnel only): printable clinic history covering the profile, health record, visits, incidents, medicines issued, and appointments.
- Dashboards:
  - clinic personnel: visits today, pending requests, today's appointments, low stock, expiring within 30 days, incidents this month; today's appointment list; medicines needing attention;
  - administrator: this month's visits, incidents, and appointments by status (real records, masked), and active users by role.
- `/admin/users`: list with search, role and status filters, and linked student number.
  - `/admin/users/new`: create clinic personnel, administrator, or student accounts. Student accounts use a picker that shows number and name only, for students without an account. Uses the service role only in `features/users/actions.ts`, after `requireRole("admin")`.
  - `/admin/users/[id]`: edit name, switch between staff and admin roles, set a temporary password, deactivate (also bans sign-in) or reactivate. An admin can't demote or deactivate themselves.
- `/account` and `/portal/account`: change own password; the current password is checked first.
- E2E: **40/40 passed** (one check fixed for CSS uppercase text). Covered:
  - reports: visits report total matches the visit log count; concerns, medication usage (2 issued, 48 left), incidents, and appointment status; Real-only default; print layout; admin monthly-only and `<5` masking; admin blocked from the student history report;
  - dashboards for both roles;
  - users: list, create (short password rejected and never echoed back, duplicate email rejected), new account signs in; password change (wrong current password and confirmation mismatch rejected, then success); deactivation ends an open session and blocks sign-in; reactivation; temporary password; staff → admin role change; admin self-protection; a student account linked to `DEMO-0002` sees only its own appointments;
  - access control for staff and students, and 360px layouts.
- Phase 3 regression after all changes: 27/27.

### Test data cleanup
- Deleted the 2 E2E accounts.
- Deleted all E2E rows: `E2E-*` students and their health records, the `E2E Ibuprofen` medicines, and the E2E visits, incidents, appointments, and their stock transactions. Stock for demo medicines was restored in the same transaction.
- Result: 3 dev accounts, 4 demo students, 5 demo medicines, 0 visits, 0 appointments, 0 incidents. Stock equals the ledger for every medicine. Clinic hours are back at Mon–Fri 08:00–17:00, 30 days ahead.

### Security advisor (after Phases 3–7)
No database changes were made in Phases 3–7. Findings:
- 12 intentional `0029` WARNs on the SECURITY DEFINER functions, as before;
- 1 new Auth WARN: leaked-password protection is disabled. This is an Auth setting and is listed for Phase 8.

## Phase 8A: Stability and demo preparation — 2026-10-14
- **Port 3100 failures:** not an application bug.
  - 10 of 11 runs reached `Ready`; their exit code 1 came from the forced stops (`taskkill /F`) during rebuilds.
  - One run failed with `EADDRINUSE`: stopping the background task killed the `npx` wrapper but left its child `next start` holding the port.
  - The logs show no runtime errors.
  - The server is now started with `node node_modules/next/dist/bin/next start`, so stopping it kills the right process.
- **Fixes:**
  - Clinic-hours form keeps submitted values, including the checked days, after a validation error.
  - New medicine with the same name (any case) and the same expiry as an existing real medicine is blocked, with a "use Restock" message. Stock integrity is unchanged: the medicine starts at 0 and the starting stock is a ledger restock. If that restock fails, the medicine page explains it and pre-fills the quantity.
  - Search values are quoted in PostgREST `or()`, so names like "O'Brien" or "Ma. Cristina" match and filter-syntax characters are harmless.
  - Asking for a page past the end (PostgREST `PGRST103`) redirects to page 1 instead of "Could not load".
  - New: `loading.tsx` skeleton and `error.tsx` boundary for the clinic and portal route groups, and a global 404 page.
- **Demo scripts (prepared, NOT run on the live database):**
  - `supabase/seed.sql`: 18 students, 12 medicines (one low, one expiring, one expired), about 40 visits, 15 appointments in every status, 8 incidents.
  - `supabase/remove-demo.sql`: deletes demo rows only and keeps demo students linked to accounts.
  - Offline PGlite validation: **25/25**. Covered a refusal when no clinic staff account exists; correct counts; stock equal to the ledger; existing edited records not overwritten; no duplicates; a second run changes nothing; cleanup removes demo data only; real records byte-identical throughout.
  - The live `auth.uid()` definition matches the offline stub. The seed would act as `dev-nurse`, the only active clinic staff account.
- **Gap E2E suite** (`phase8a`, 23 checks):
  - fixes from this phase: clinic-hours inputs kept, duplicate medicine blocked, a separate batch with a different expiry allowed, restock prefill;
  - search: punctuation in names, filter-syntax characters, wildcard-only text;
  - an out-of-range page redirects; the 404 page;
  - filters not tested before: appointment date filter, staff monthly report, user list role and status filters, inactive medicine filter;
  - **two simultaneous issuances that together exceed stock: exactly one succeeds, stock 2, ledger matches**;
  - the streamed page sends the loading skeleton first.
- **Streaming note:** with route-level `loading.tsx`, pages stream. When `notFound()` runs after streaming has started, the response status is already 200, but the "Page not found" page is still shown. The test helpers now wait for the skeleton to clear before reading a page.
- **Regression fix:** the Account link added to the portal header made the page scroll sideways at 360px. Small screens now show only the brand mark.
- **Full regression on a clean baseline:** Phase 3: 27/27; Phase 4: 19/19; Phase 5: 44/44; Phase 6: 18/18; Phase 7: 40/40; Phase 8A: 23/23 → **171/171**.
- `tsc` passes; lint has 0 errors (5 warnings, all in `.pixel-agents/`); the production build passes.
- **Test data:** removed after every run with a scoped script (E2E rows and E2E accounts only; demo stock restored). The database is back at its baseline: 3 dev accounts, 4 demo students, 5 demo medicines, no activity, stock equals the ledger.
- **Remaining E2E gaps (not automated):**
  - an unlinked student account (needs migration 0010);
  - error-boundary rendering (no safe way to force a server error);
  - calling a server action directly with another role (covered by `requireRole` in every action plus database RLS, which was verified live in Phase 2);
  - session expiry;
  - keyboard and screen-reader checks (Phase 8B).
- **Demo seed: run once on the live database (approved), 2026-10-14.**
  - Preflight:
    - project Research, `ACTIVE_HEALTHY`;
    - `seed.sql` unchanged since validation (sha256 `cd0a54dd…`; offline suite re-run 25/25);
    - baseline as expected: 4 demo students, 5 demo medicines, no activity, 0 real records;
    - `dev-nurse` was the only active clinic staff account and acted as the seed identity.
  - Result: 18 demo students; 18 health records (`DEMO-0001`–`0004` kept their existing values, 14 new ones filled); 12 demo medicines; 40 visits (2026-07-22 to 2026-10-09, all 10 concern categories, 2 linked to completed appointments); 15 appointments (3 pending, 4 approved, 4 completed, 2 declined, 2 cancelled); 8 incidents (all 4 types); 52 stock transactions (12 restock, 40 issuance) with issuance dates matching their visits and incidents.
  - Stock equals the ledger for every medicine.
  - Real records: 0 students, 0 medicines, 0 transactions, unchanged. No accounts were created; still 3 profiles and 3 auth users.
  - Flags shown: Cetirizine low (7 / reorder 10), Loperamide expired, Mefenamic Acid expiring 2026-11-03.
  - Read-only smoke tests on the seeded data: **29/29**. Covered:
    - Real/Demo filters on students, visits, and medicines;
    - visits paging (25 + 15);
    - health record and history shown;
    - pending queue and sidebar count (3), upcoming (4);
    - inventory flags; Paracetamol stock 16 with the ledger matching on its page;
    - all reports with demo scope (visits total 40, 10 concerns, Paracetamol 34 issued, incidents 8, appointments 15) and Real scope empty;
    - admin masking; both dashboards; the student history report;
    - the dev student sees only their own appointments.
  - Counts were unchanged after the smoke run.
  - `remove-demo.sql` was not run.

## Phase 8B: UI/UX polish and accessibility audit — 2026-10-14
Approach: a refinement of the existing system (deep-green tokens, compact shadcn layout), not a redesign. Evidence came from one batch: 34 pages for all three roles (staff, admin, student) captured at 1280 and 360px, an overflow sweep at 360/768/1024px, and an axe-core WCAG 2.0/2.1 A/AA plus best-practice scan. axe-core and playwright were installed outside the project, so no project dependency was added. All checks are read-only against the seeded demo data.

### Before
- Overflow: none at any width.
- axe: 3 issues.
  - **Colour contrast:** success text (Active and Completed badges, success alerts) 4.3–4.4:1, and the destructive button text 4.47:1. AA needs 4.5:1.
  - **Nested `<main>`:** when `notFound()` ran inside the app, the 404 page's own `<main>` sat inside the app's `<main>` (duplicate landmark).
- Manual review:
  - no skip link;
  - link focus outline used the 50%-opacity ring (weak);
  - filters on phones stacked one per row and pushed tables far down;
  - destructive actions ran on one click (deactivate account or medicine, cancel appointment, cancel request);
  - the student header's 5 actions wrapped into 3 heavy rows on phones;
  - report counts sat far from their labels on wide screens;
  - uneven field grid on the appointment detail page;
  - the loading skeleton pulsed even with reduced motion requested.

### Changes
- Tokens: `--success` 0.52→0.46 L, `--info` 0.52→0.47, `--destructive` 0.55→0.50. All status text now meets AA on its tinted background.
- Focus: links, summaries, and checkboxes get a solid 2px `--ring` outline (`:focus-visible`).
- Skip to main content link in the clinic and portal layouts; the portal `<main>` now has `id="main"`.
- The 404 page uses a `<div>` instead of a nested `<main>`.
- `ActionForm` gained an inline two-step confirmation (no modal). The confirm button receives focus, the message explains the consequence, and "Keep it" cancels. Used for deactivate account, deactivate medicine, staff cancel appointment, and student cancel request.
- Filters: two per row on phones (`w-[calc(50%-.375rem)] sm:w-*`).
- Tab padding is tighter on phones.
- Student header secondary actions use the small button size.
- Reports table width is capped (max-w-2xl, or 3xl for medication usage), so counts sit next to their labels.
- Appointment remarks span the full row.
- The skeleton respects `prefers-reduced-motion`.

### After
- axe: **0 violations on all 34 pages**. Overflow: 0 at 360, 768, and 1024px.
- Keyboard and focus checks: **16/16**. Covered:
  - skip link first in tab order, visible on focus, jumps to `#main`;
  - solid 2px focus ring on table links;
  - inline confirmation reachable by keyboard, takes focus, "Keep it" cancels without submitting;
  - mobile menu opens with Enter, Escape closes it, and focus returns to the menu button;
  - invalid fields carry `aria-invalid` and `aria-describedby`, and form errors sit in an alert region;
  - portal skip link and a single `<main>`.
- Seeded smoke tests: **29/29**. `tsc` passes; lint has 0 errors (5 warnings in `.pixel-agents/`); the build passes.
- The write-based E2E suites (Phases 3–7 and 8A) were updated for the confirm step but **not run**, because they create rows and issue demo stock, which would change the seeded demo data. Run them on a fresh database, or seed again afterwards.

### Remaining (minor)
- At 360px the student header still wraps to 3 short rows. Acceptable; an overflow menu would remove it.
- Record tabs scroll sideways on phones; the cut-off tab shows that more exist.
- Buttons are 32px tall. That meets WCAG 2.2 AA target size (24px) but not the 44px comfort guideline.
- Not tested: screen readers (NVDA/VoiceOver), 200% zoom, and Windows high-contrast mode.
- No `PRODUCT.md` or `DESIGN.md` yet; `/impeccable init` and `document` could record the design system.

## Phase 8C: Authentication finalization and final QA — 2026-10-14
### Authentication
- **Migration 0010 reviewed:**
  - compatible with registration by email, student number, and password;
  - works whether "Confirm email" is on (the profile is created when the email is confirmed) or off (created at sign-up);
  - offline PGlite suite **160/160**; sha256 `58bb25c8…`;
  - **not applied**.
- **Built behind `STUDENT_REGISTRATION=enabled` (off by default, server-only):**
  - `/register` (`registerStudent` action; Student ID sent as `user_metadata`; generic error messages; never echoes the password);
  - `/auth/confirm` (PKCE `code` and `token_hash`; same-site redirects only);
  - `/students/registrations` for clinic personnel (pending list, matching record, approval through `approve_student_link` with an inline confirmation);
  - a sidebar Registrations count;
  - the login link to registration;
  - "Pending approval" label in the user list.
- `types/database.ts` updated by hand to match 0010. Regenerate it after applying.
- `scripts/create-admin.mjs`: first administrator; hidden password prompt; refuses if an administrator exists; no credentials in code. Not run.
- `docs/AUTH_PROVISIONING.md` §4 and §7 rewritten, including the risks of running without email confirmation.

### UI and accessibility follow-ups
- At 360px, the student header's Edit and History report buttons are icon-only (labels kept for screen readers), so the header fits in 2 rows.
- Forced colors: only the current tab is underlined, and the current sidebar item has a highlight outline. Before this fix, transparent borders made every tab look selected.

### QA (production build, live project)
- **Isolated full regression: 171/171** (Phase 3 27, Phase 4 19, Phase 5 44, Phase 6 18, Phase 7 40, Phase 8A 23).
  - The suites were retargeted at isolated fixtures: demo-flagged `DEMO-9001`–`9003`, `Fx ` medicines, a fixture student account, and `E2E-` rows.
  - All fixtures were removed afterwards.
  - **Approved demo data unchanged**: the SHA-256 snapshot of `DEMO-0001`–`0018` with their health records, visits, appointments, and incidents, the 12 seeded medicines, their transactions, and clinic settings matched before and after (`0eb0126d…`).
- **Auth surfaces, zoom, and forced colors: 26/26.**
  - Registration hidden while off; confirm route rejects a missing or bad token and never redirects off-site; generic wrong-password error; signed-out redirect; sign-out.
  - 0 horizontal scroll at 200% zoom (640px) and at 320px on the main pages and the portal.
  - Forced colors keep focus outlines and button borders.
- Keyboard **16/16**, seeded smoke **29/29**, axe **0 violations on 34 pages**, 0 overflow at 360, 768, and 1024px.
- `tsc` passes; lint has 0 errors (5 warnings in `.pixel-agents/`); `next build` passes.

### Handoff documents
- `README.md` (setup, environment, migrations, demo data, accounts, structure, limitations)
- `docs/TEST_CASES.md` (all §13 criteria with expected and actual results)
- `docs/DEPLOYMENT.md` (checklist)
- `SYSTEM_SPEC.md` v2.2 §16 (implementation status)
- `PLAN.md` status table
- `.env.example` (`STUDENT_REGISTRATION`)

### Waiting for approval
1. Apply migration 0010, then regenerate types.
2. Supabase Auth settings: sign-ups on; "Confirm email" off for the demonstration (risks documented) or on with SMTP; Site URL and redirect URLs; minimum password length.
3. Set `STUDENT_REGISTRATION=enabled`, then run the live registration test (register → pending → approve → request).
4. Create the real first administrator with `scripts/create-admin.mjs`.
5. Before deployment: rotate the service-role key; remove the dev accounts; enable leaked-password protection; decide on email delivery (Q-A1).

# PRD — Stanvard School ERP

## Original Problem Statement
User provided GitHub repo https://github.com/neetamundra73-maker/STANVARD-ERP-BY-NEET.git and asked to "add some more functions". Feature selection was skipped by the user, so sensible defaults were chosen.

## What the App Is
Multi-school ERP (React + FastAPI + MongoDB) for the Stanvard school group: students, fees (plans/assignments/collection/receipts with Razorpay mock mode), discount approvals (owner workflow), attendance, homework, timetable, events, circulars, gallery, staff, notifications, reports/analytics, audit logs, and a parent portal.

## User Personas
- Super Admin (group level), School Admin, Accountant, Teacher, Owner (discount approver), Parent (multi-child portal)

## Implemented (2026-08-11)
- Ported the repo into /app (React frontend on 3000, FastAPI on 8001, Mongo via MONGO_URL/DB_NAME), installed deps, seeded 3 schools + users + students + fees + attendance (seed.py), JWT_SECRET added to backend/.env.
- NEW MODULE: Examinations & Report Cards
  - Backend: GET/POST /api/exams, GET/PATCH/DELETE /api/exams/{id}, POST /api/exams/{id}/marks (bulk upsert, absent = null), GET /api/exams/{id}/results (ranks), GET /api/students/{id}/report-card (+ .pdf), grade scale A+ >=90 … F <33. Collections: exams, marks (unique exam_id+student_id).
  - Frontend: /exams page (create exam with dynamic subject rows, marks entry grid, results dialog with ranks + per-student report card PDF, publish/unpublish, delete); parent /parent/results page showing published report cards with PDF download.
  - Seed: seed_exams.py seeds "Half-Yearly Examination" (published, 5 subjects, 8 students) in GN school.
- NEW FEATURE: Bulk Student CSV Import — POST /api/students/import (multipart, validates full_name/class_name, auto admission numbers using school's academic session year, per-row error report); Students page "Import CSV" dialog with template download.
- Test credentials maintained at /app/memory/test_credentials.md.

## Testing
- iteration_5.json: 17/17 backend pytest + full Playwright pass (exams CRUD, marks entry, results/ranks/grades, report card PDF, parent 403/200 scoping, CSV import, regression smoke on Dashboard/Students/Receipts/Attendance, parent portal results).
- iteration_6.json: real-data reseed verified — 375 students (KNP), 23/23 backend tests, parent mobile login, exam module re-verified against real data.
- iteration_7.json: fee structure changes — 4/4 new backend tests + 23/23 regression + UI pass.

## Implemented (2026-08-11, iteration 2) — Fee structure changes
- Main fee plan: monthly grid now editable for ALL 12 months. June & March default to ₹0/"No Fee" but accept amounts (amber override cells); setting any collection month to 0 skips it. Backend `_build_plan_installments` honors overrides for June/March and treats zero-overrides as skip.
- New endpoint: GET /api/fees/plans/{id}/installments — the plan's 12-month timeline (source of truth).
- BUGFIX (plan vs student assignment clash): AssignFeeDialog now builds the student's timeline FROM the plan's timeline (scaled by the student's personal concession so the total == Net Payable), edit mode no longer shows stale saved installments for plan-based assignments, and collection months auto-sync from the plan.
- Verified: student timeline sum == Net Payable (₹24,500 = 10 × ₹2,450), June/March No Fee in plan editor, student dialog and parent portal.

## Implemented (2026-08-11, iteration 3) — Sync bugfix (user-reported)
- BUG: editing a student's plan-based assignment showed the stale default month list (May charged, March missing) instead of the plan's months (May/June skipped, March charged). Cause: `monthsHydratedRef` guard trusted the assignment's saved default `collection_months`. Fix: plan mode ALWAYS syncs collection months from the plan timeline; ref removed.
- Verified (iteration_8): user's real Class VIII '8th demo' plan (₹37,000, May/June skip, March ₹3,700) now renders identically in the student dialog (May/June No Fee, March charged, sum == Net Payable). New test: backend/tests/test_class_viii_may_june_skip_march_charge.py.
- One-shot backfill: plan-based assignments' stored collection_months reconciled with their plan's active months.

## Implemented (2026-08-11, iteration 4) — Month-amount editing bugfix + post-save popup
- BUGFIX (double-count): months carrying one-time fee heads showed the combined amount in the input; retyping it stored the full value as the recurring override and the backend added the one-time fee AGAIN (e.g. 8700 -> 13700). Now the override stores only the recurring part (typed − one-time total); backend composes override + one-time exactly once.
- FLOOR RULE: a month with one-time fee heads can never go below their sum — input min + clamp with warning toast; increases are unbounded. Caption "incl. ₹X one-time" shown on such cells.
- Post-save popup (data-testid=postsave-dialog) after every plan save: "Set Live to Students" (existing set-live endpoint; disabled when classless/already live) or "Copy as Draft" (new POST /api/fees/plans/{id}/duplicate → '<name> (Copy)' draft, never touches students) or "Not now".
- Verified (iteration_9): 39/39 backend tests across 4 suites + full Playwright assertions (clamp toast, April=8700 stays 8700 after retype, duplicate creates draft copy, set-live disabled states).

## Implemented (2026-08-11, iteration 5) — Free-typing month inputs (user-reported UX bug)
- BUG: floor rule clamped on every keystroke, blocking typing (typing "4000" in a ₹5,000-floor month snapped instantly). Fix: new MonthAmountInput component — free typing while focused, live preview commit for valid ≥ floor values, floor reset + warning toast only on BLUR; empty on blur = reset to auto-split.
- iteration_10 caught a file corruption from the edit (orphan fragment + missing component) — repaired; webpack compiles clean.
- Verified (iteration_11): 35/35 backend tests + Playwright char-by-char proof (4→40→400→4000 no snap while focused, blur resets to 5000 + toast), persistence, no double-count via installments API.

## Implemented (2026-08-11, iteration 6) — Student-section edit removal, parent upcoming fees, assignment wipe, picker fix
- Student section: removed the Edit (pencil) option from fee assignment cards — fees are only editable via the main Fee Structures section. "New Assignment" + delete remain.
- Parent portal: ParentHome now shows an "Upcoming Fees" card fed by the monthly fee schedule (same source as the student's Monthly Fees tab): next 4 unpaid months with amounts + status badges, Pay link to /parent/pay.
- Data: all 375 fee assignments deleted at user request (fresh assignments to be created by user).
- BUGFIX (fee collection picker): LKG/other students were missing because the picker hard-capped at the first 200 students. Now lists up to 500, each option shows class, search matches class names, and a class-wise filter dropdown (fee-collect-class-filter) was added.
- Verified (iterations 12-13): 35/35 backend tests; picker shows all 375 students, LKG filter narrows to 13; no pencil on assignment cards; parent Upcoming Fees populates per-child and refetches on child switch.

## Implemented (2026-08-11, iteration 7) — Picker dropdown + filter persistence (user-reported)
- Fee Collection: selecting a class now swaps the search popover for a plain student dropdown of that class (fee-collect-class-student-select); switching class clears an out-of-class selection. Added explicit "no fee assignment" empty state when a picked student has no schedule.
- Students page: class filter (and section filter) now persist via sessionStorage — navigating to a student and coming back keeps the filtered list (also survives reload).
- Verified (iteration_14): 100% frontend pass — dropdown lists exactly the class's students, class switch resets selection, filter restored after back navigation and hard reload.

## Known Notes / Backlog
- P1: server.py is ~4200 lines — split into routers (exams, fees, auth...) for maintainability.
- P1: report-card.pdf served with Content-Disposition: inline; consider ?download=1 option.
- P2: Class-wide report card bulk PDF (all students, one file).
- P2: Exam analytics (class average, subject toppers, pass/fail distribution).
- P2: CSV import should return non-200 when 0 rows created.
- P2: Existing create_student endpoint still hardcodes "2025" in admission numbers (pre-existing repo behavior).
- Razorpay runs in MOCK mode (no keys configured) — pre-existing behavior.

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

## Known Notes / Backlog
- P1: server.py is ~4200 lines — split into routers (exams, fees, auth...) for maintainability.
- P1: report-card.pdf served with Content-Disposition: inline; consider ?download=1 option.
- P2: Class-wide report card bulk PDF (all students, one file).
- P2: Exam analytics (class average, subject toppers, pass/fail distribution).
- P2: CSV import should return non-200 when 0 rows created.
- P2: Existing create_student endpoint still hardcodes "2025" in admission numbers (pre-existing repo behavior).
- Razorpay runs in MOCK mode (no keys configured) — pre-existing behavior.

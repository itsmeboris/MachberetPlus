# Machberet+ Pilot Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task. User explicitly waived further design questions and approved a web pilot.

**Goal:** Deliver the full Hebrew scan → adult confirmation → assignment → accessible completion → teacher voice review → parent acknowledgement workflow.

**Architecture:** An installable React web app, a same-origin Hono API on Cloudflare Workers, and a D1 SQLite database. Files are stored in bounded database chunks so permissions, deletion, and deployment do not depend on a separate public media store. Teacher sessions and protected student sessions use secure cookies; parent links use random, hashed, expiring, revocable assignment-scoped tokens.

**Tech Stack:** TypeScript, React, Vite, Hono, Wrangler, D1, PDF.js, Tesseract.js Hebrew OCR, Vitest/Miniflare, Playwright.

**Spec:** `docs/pilot-brief.txt`, copied verbatim from the user's attachment. The newer pilot brief overrides the older PRD. Target: Android browser, installable PWA; desktop teacher and mobile parent layouts also supported.

## Global constraints
- One page at a time; printed Hebrew, short answers, whole-number arithmetic, simple fractions, one-variable equations.
- Adult confirmation precedes assignment. No automatic grading.
- Hebrew RTL and isolated LTR math; preserve Nikud; editable spoken text and recorded instructions.
- Standard targets 64 × 64 CSS pixels; gaze/motor 88 × 88; 20px gaps; primary controls 48px from edges.
- Spotlight opacity 85%; dwell 800–1500ms, progress/cancel/pause, exclusive app/device activation.
- Keyboard and two-switch answer entry/correction; collapsible AAC; persistent preferences.
- No background camera, microphone, or gaze recording. Consent and deletion required.
- No claim of hardware compatibility without actual participant-device testing.

## Review focus
- A stale save must not overwrite acknowledged newer work; test revision conflict and reload/retry.
- A copied identifier must not cross teacher/student boundaries; exercise every read/write path with another account.
- Expired/revoked parent links must not access files or acknowledge work; test at the API boundary.
- Failed upload/OCR and interrupted saving must retain recoverable work; simulate network interruption.
- Long Hebrew/Nikud, narrow screens, and large targets must remain navigable; browser tests plus real hardware gate.

## Task 1: Persistent domain and authorization
Files: `server/index.ts`, `server/database.ts`, `server/auth.ts`, `server/assignments.ts`, `migrations/0001_initial.sql`, `tests/api.test.ts`, `wrangler.jsonc`.
Interfaces: same-origin `/api`; JSON errors `{error}`; session actor `{id,role}`; assignment statuses `draft|assigned|in_progress|submitted|reviewed|returned|parent_acknowledged`; optimistic integer revisions.
- [ ] Write failing API tests using real Miniflare/D1 for registration/login/logout, student pairing, consent, ownership, assignment transitions, saves and revision conflicts, scoped parent links, revocation/expiry, acknowledgements, preferences, and deletion.
- [ ] Run `npm test`; confirm missing routes/behavior cause failures.
- [ ] Implement schema and validated API; hash passwords and opaque secrets; reject cross-origin mutations and rate-limit login; store minimal lifecycle events.
- [ ] Run `npm test`; all assertions pass; commit task.

## Task 2: Capture, correction, and teacher preparation
Files: `src/App.tsx`, `src/api.ts`, `src/features/capture/*`, `server/media.ts`, `src/styles.css`, `tests/capture.test.ts`, `tests/media.test.ts`.
Interfaces: source media ID, corrected exercise list `{id,kind,prompt,math,spokenText,operands}`, adult-confirmed draft assigned to one owned student.
- [ ] Test media limits/ownership and crop/perspective coordinate mapping, OCR extraction and manual fallback.
- [ ] Implement photo/upload/PDF single-page selection, crop/rotate/four-corner perspective correction, local Hebrew OCR worker, source alongside editable candidate exercises, selection/confirmation, manual creation, and recorded teacher instructions.
- [ ] Verify malformed files and OCR/network failures preserve the draft. Run tests/build and commit.

## Task 3: Accessible student tray and workbook
Files: `src/features/student/*`, `src/accessibility/*`, `src/offline/*`, `tests/accessibility.test.ts`, `tests/save.test.ts`, `public/manifest.webmanifest`, `public/sw.js`.
Interfaces: assigned mission list and revisioned answer save; persisted preferences; local queued drafts bound to actor and assignment.
- [ ] Write failing tests for debounce/save recovery, stale saves, switch groups/key correction, dwell cancellation and duplicate suppression, math speech/Nikud preservation.
- [ ] Implement single mission card, pending/completed separation, one question and inline answer area, vertical arithmetic with carry/borrow, fractions/equations, read-aloud, spotlight, collapsible AAC, settings, autosave/status/retry, submission, and installable offline shell.
- [ ] Verify keyboard and switch-only completion, 800/1500ms dwell limits, 64/88px targets, gaps, edge clearance, and 85% spotlight. Run tests/build and commit.

## Task 4: Teacher review and parent loop
Files: `src/features/review/*`, `src/features/parent/*`, `src/components/AudioRecorder.tsx`, `tests/review.test.ts`, `tests/e2e/workflow.spec.ts`.
Interfaces: review decisions, up-to-15-second feedback media, reviewed-assignment parent token, acknowledgement timestamp, printable record.
- [ ] Test submitted-only review, return/resubmit, recording duration, no early sharing, token expiry/revocation, repeat acknowledgement, and scoped media.
- [ ] Implement question/answer review, stickers/voice, return/review, user-initiated WhatsApp/copy sharing, account-free parent view/listen/acknowledge, teacher acknowledgement status, printable/downloadable record.
- [ ] Browser-test full workflow with separate teacher/student/parent sessions and restart persistence; commit.

## Task 5: Pilot measurement, deployment, readiness
Files: `src/features/pilot/*`, `docs/readiness.md`, `docs/deployment.md`, `tests/e2e/readiness.spec.ts`.
Interfaces: consented pseudonymous assignment events; explicit baseline/session observations separating interface assistance from teaching assistance and grouped by input mode.
- [ ] Test consent/deletion propagation, event minimization and metric calculations including 48h acknowledgements.
- [ ] Implement observation entry and report/export for all seven brief targets; document four-week protocol, 10–15 students, 3–5 adults, at least three assignments/student/week.
- [ ] Run unit/integration/browser/accessibility/security checks; independent final review, address material findings.
- [ ] Deploy persistent service, verify live complete workflow and restart persistence. Record exact evidence and unresolved real-device checks; never substitute emulation for gaze/switch hardware validation.

## Execution decisions
- Implement inline in the supplied new workspace; there was no repository or existing app to isolate. Branch `pilot-web`.
- Use browser-local OCR initially to avoid sending worksheet photos to an extra third-party recognition service; benchmark supported Hebrew/math pages before readiness.
- Deployment platform adapter may change if connected hosting requires it; preserve the complete permissions/persistence contract.
- Field use and participant-device certification remain explicit external readiness gates, not claims made from automated tests.

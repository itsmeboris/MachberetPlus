# Readiness evidence — 2026-10-31

## Teacher-directed focus sessions

Current deployed version: `c1ea6bbb-8a7f-4453-ac49-c20c69f3d8df`, migration 0007 applied. Teacher classroom controls start or stop a five-minute focus session for one student. Question/answer, help and navigation stay readable; background dims. Students can end focus, including offline; expiry and dismissal persistence are independent of answer saving and personal settings. Receipt is explicitly not an attention signal. See teacher-focus.md.

Verification: 72 unit/API tests and production build passed. Both new browser scenarios passed locally and on deployed HTTPS, covering teacher/student interaction, uninterrupted typing, unchanged preferences, receipt/stop/dismiss, offline expiry, dismissal across reload, submitted-work navigation, three-theme axe scans and forced colors. Classroom distribution and two external-input regressions also passed locally. Live synthetic accounts were deleted. Independent review findings about read-only navigation and offline dismissal were fixed; phone screenshot visually inspected. Actual participant/eye-tracker hardware remains untested.

A provider backup was exported before migration. Direct D1 local import failed due to exported table ordering; an isolated SQLite restore passed integrity and foreign-key checks. Private backup files remain outside Git.

## Original-brief audit and assistive spacing

Previously deployed version: `f71539cc-eb0d-4266-8d45-efe24ec501e5`. Corrected assistive keypad gaps to 20px while retaining 88px targets, reflowed narrow keyboards to avoid overflow, restored 64px standard tablet keys and preserved compact standard phone keys. Seven local access/keyboard/spacing checks, four live checks, production build, a new PDF page-selection/persistence test and current worker-restart persistence smoke passed. Synthetic accounts cleaned up; no schema changes.

See pilot-completion-audit.md for requirement-by-requirement evidence. Actual participant-device validation and field outcomes remain unproven; software acceptance alone does not close the original goal.

## Earlier student theme menu update

Previously deployed version: `6d29c425-9d89-40ac-99d2-bb0e661c1c01`. Warm cream default plus pale blue/dark slate, a direct student toolbar menu, immediate per-student saving and a reset that preserves other settings. Readable state/focus/error palettes and forced-color/print overrides included. Independent review's save-focus and delayed-load races fixed and regression-tested.

Verification: 70 unit/API tests, 25 local browser tests (one optional private-photo test skipped), build, seven targeted browser checks after the final focus/loading fixes, and eight final live scenarios passed. Live checks cover theme persistence/reset/failure recovery, contrast, keyboard/mobile input and the worksheet-to-parent workflow. Synthetic accounts deleted; no migration. Actual Android/TalkBack participant testing and initial cream flash before authentication remain documented limitations.

## Earlier accessible design update

Previously deployed version: `e44e821a-9238-49fc-bd1a-c598f24040eb`. Reworked shared colors, typography, field boundaries, selected/disabled states, keyboard focus, skip navigation, question focus and non-drag crop controls. All 70 unit/API tests, 24 local browser tests and production build passed; one opt-in private-photo OCR test was skipped. After a live-only transient contrast finding, removed button color interpolation and reran the three accessibility tests successfully. See accessibility-review.md for measured contrast, scope and actual-device limitations.

## Earlier free local handwriting update

Previously deployed version: `1a8c25d8-fd1e-4440-b3eb-f94e84014dd1`. Pix2Text-MFR-1.5 now recognizes handwritten math on-device by default. All 69 unit/API tests and 21 browser tests passed, including both private original photos through the actual WASM model. Build and independent review passed. The live-site test also passed both photos with exact equations, zero upload/POST requests during recognition, and cached second-photo recognition with the model host blocked. Live timings: 19.8s first run, 4.0s cached, on desktop Chromium. The synthetic account was deleted afterward.

Review found saved-source cancellation after navigation and mixed-fraction meaning changes; both were fixed, regression-tested and re-reviewed. No database migration or server inference changes. Private photos/derived crops and downloaded research models remain outside Git. The model handles math, not handwritten Hebrew prose; actual Android speed/memory and broader handwriting accuracy remain unverified. See free-handwriting.md for model comparison, licenses, download size and limits.

## Earlier phone and review update

Previously deployed version: `db8b2031-3811-4768-9535-a96d64e81d25`. Phone keypad now fits three columns at 320/390px with decimals, labeled extra symbols and preserved 88px accessible targets. Settings explain external eye pointers and dwell, and question focus updates immediately. Students can withdraw an unreviewed submission, correct and resubmit; teachers can mark each exercise and return reviewed work with old parent access revoked.

Verification: 39 unit/API tests across 12 files, production build and 18 local browser tests passed. Six live scenarios passed across targeted runs: correction/resubmission, touch with dwell, compact decimal keypad, reactive accessibility modes, teacher marking/parent export/return/revocation, and the existing scanned worksheet-to-parent workflow. Synthetic accounts were cleaned up. Live harness fixes restricted a synthetic client-IP header to localhost and awaited completed review before checking saved marks. The independent review's parent-link issuance/return race was fixed with a guarded insert, tested and re-reviewed. No migration was needed. Visual check: `artifacts/student-mobile-keypad.png`.

Actual participant hardware validation remains outstanding. Recognition was unchanged in the phone update; the subsequent free recognition update is documented above.

## Previous release evidence — 2026-10-30

| Check | Result |
|---|---|
| `npm test` | 35 passed across 9 files, including real Miniflare/D1 integration |
| `npm run build` | TypeScript and production Vite build passed |
| `npm run test:e2e` | 13 Chromium browser tests passed |
| `node scripts/smoke-production.mjs` | Built assets served; answer and session survived worker restart; synthetic account cleaned up |
| `npm audit --omit=dev` | Zero reported vulnerabilities |
| Visual inspection | Teacher desktop and student mobile screenshots in `artifacts/` inspected |
| Live HTTPS acceptance | 3 passed in 52.9s: classroom distribution/retry/clipboard, both actual handwritten photographs, and full review/parent/download/revocation workflow; synthetic accounts cleaned up |

Live URL: https://machberet-pilot.machberet-pilot.workers.dev. Verified worker version: `d54f67bc-72e8-45a8-81bd-35cfda628c49`. Source: https://github.com/itsmeboris/MachberetPlus, branch `main`. The live checks use synthetic sessions, a generated printed worksheet and the two privately supplied photographs; they do not constitute participant hardware testing. Redeploy persistence was previously verified on version `a9c53f07-0bf2-4aad-9a5f-b94099be951f`; this update's live run did not trigger another redeployment. Migration 0006 was additive and production user/assignment counts matched before migration and after test cleanup. Screenshots: `artifacts/live-parent-mobile.png`, `artifacts/classroom-progress.png`.

## Classroom feedback update

One prepared task now distributes to a roster with separate answers/media/feedback and grouped progress. API tests cover 30 students, ownership, idempotence and bounded query counts. Draft audience survives reopening; interrupted delivery retries the same confirmed version. Student entry links are reusable for seven days with copy/share, renewal and revocation. Password guidance is visible before typing. Cropping uses drag/touch/keyboard corners with staged rotation/cancel/apply; review has clearer Hebrew and optional feedback disclosure. Both supplied photos returned exactly all three equations through the live browser and cloud recognition endpoint. See recognition.md for scope and data-processing details. Google/Microsoft sign-in is explicitly deferred by the user; setup is documented, not claimed implemented.

Independent review found two important issues in the update (draft recipient persistence and delivery retry). Both were fixed, regression-tested and re-reviewed with approval before deployment.

Browser coverage includes registration/consent, pairing, image persistence, actual Hebrew OCR on one printed fixture, parent-photo handoff through assignment, saved-answer resume, recorded feedback playback, parent acknowledgement, audio-embedded HTML download, returned feedback, network retry, persistent conflict resolution, switch entry/deletion, vertical carry cells and dwell pause/resume.

API coverage includes ownership, same-origin mutations, sessions, expiry/revocation, confirmation/answer revision conflicts, media lifecycle, deletion, preference bounds and measurements. Independent code review found five material issues: returned feedback visibility, vertical switch focus, concurrent draft confirmation, media lifecycle races, and vertical working in review. All were addressed with targeted regression coverage. Upload chunk writes also enforce completion/state guards in SQL.

## Implemented

All five screens are present: image/PDF capture with rotation and perspective correction, editable OCR/manual exercises and adult confirmation; student tray/workbook with text and supported math, carry/borrow cells, read-aloud, spotlight, AAC and autosave; teacher stickers/voice/return/review; scoped parent view/listen/acknowledge. Consent, deletion, measurements and downloads are included.

Controls use 64px standard and 88px motor/gaze/switch targets, 20px gaps, primary edge spacing, 85% spotlight and 800–1500ms dwell. App/device dwell sources are exclusive in settings. Narrow-phone keyboards scroll; comfort and fatigue require participant evaluation.

## Outstanding gates

1. **Deployment gate passed:** Persistent HTTPS hosting and all six production migrations verified. Live workflow tests pass; synthetic test data was deleted. Re-run live acceptance after material deployment changes.
2. **Devices:** Test every participant's Android/browser/gaze/physical-switch combination, including duplicate activation, cancel/pause, focus, scrolling, correction and submission. Browser emulation is not hardware certification.
3. **OCR:** One printed fixture and two handwritten photos are not a general accuracy benchmark. Evaluate representative printed/handwritten Hebrew/Nikud, fractions, equations, angled/glare photos, PDF page selection and failure recovery. Measure corrections and retain manual fallback.
4. **Speech:** Verify actual installed Hebrew voices and mathematical phrasing. Use corrected spoken text or recorded instructions when needed.
5. **Operations:** Confirm consent/retention, incident and account-recovery owners, and provider backup restoration. No legal-compliance certification is claimed.
6. **Field outcomes:** No participant trial has run; no success target or independence improvement is claimed from synthetic tests.

## Measurement and export limits

The report shows review completion separately from observed blocked sessions. Observations are not assignment-linked, so reconcile with a minimal incident log to measure review *without* a blocker. Timings are observer-entered. Interface help is separated from teaching help and compared within student/input mode; use the exported observations to stratify the pooled app/timing summaries by mode. Parent rates separate still-open 48-hour windows. Zero-baseline assistance has no defined percentage reduction.

Recovery covers unsent drafts and resumed online sessions, not a fully offline service. Print/PDF is not formally validated accessible PDF. Voice feedback is embedded in the digital HTML download, not playable on paper.


Final accessibility release live verification: 7 scenarios passed on e44e821a-9238-49fc-bd1a-c598f24040eb; synthetic accounts cleaned up. See accessibility-review.md.

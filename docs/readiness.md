# Readiness evidence — 2026-10-30

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

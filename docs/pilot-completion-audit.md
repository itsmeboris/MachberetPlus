# Original pilot brief: completion audit

Audited 2026-10-31 against the original attached brief, current source, browser tests and deployment evidence. This is a completion gate, not a claim that participant trials have happened. The preceding goal turn made progress: deployed saved student themes with eight passing live scenarios.

## Scope and subsequent instructions

The original sequence remains capture → confirm → assign → solve → review → share → acknowledge. Later user feedback added classrooms, handwritten-math recognition, corrections, per-exercise marking and personal color themes. Later approved accessibility work replaced the 85% dark spotlight mask with a question outline so navigation/help remain readable. The user explicitly requested a compact phone keypad; its 48px standard-phone targets are intentional, while standard tablet and assistive-mode requirements remain applicable.

## Requirement evidence

| Requirement | Current evidence | Completion status |
| --- | --- | --- |
| Deployed Hebrew-first persistent service | `server/index.ts`, deployment log in `readiness.md`; live same-origin API/UI | Software verified; participant use not demonstrated |
| Teacher image and parent photo upload | `Capture.tsx`, `ParentCapture.tsx`; `capture.spec.ts`, live workflow | Browser verified; real camera/device permission behavior pending |
| PDF page selection, one page at a time | `pageFile.ts`, PDF/page controls; `pdf-page.spec.ts` passes with generated two-page PDF, out-of-range rejection and saved source aspect ratio | Selected-page rendering/persistence browser verified; representative real classroom PDFs still need field checks |
| Crop, rotate and perspective | `ImageEditor.tsx`, geometry tests, image-editor browser tests | Automated geometry/interaction verified |
| Printed Hebrew and supported math recognition | local recognition implementation; printed fixture browser test | Fixture verified; representative classroom-page accuracy pending |
| Source preview, correction, selection and adult confirmation | capture implementation; assignment confirmation API tests and capture workflow | Automated workflow verified |
| Manual creation when recognition fails | capture editor and local-recognition-controls tests | Automated workflow verified |
| One mission, start/resume, separate completed work, teacher audio | student source, workflow/returned tests, live audio workflow | Automated workflow verified |
| One active question and answer; Hebrew and isolated LTR math | student/MathAnswer/MathText source, accessibility and workflow tests | Rendered browser checks; actual RTL reading order with TalkBack pending |
| Vertical arithmetic with carry/borrow cells | MathAnswer and AnswerView; vertical two-switch browser scenario | Browser entry/review verified |
| Fractions and basic equations | MathText, mathSpeech, formula/export tests and supplied-photo recognition | Parsing/rendering coverage; representative participant comprehension pending |
| Read-aloud, Nikud, editable spoken text, recorded alternative | interaction tests preserve Nikud and substitute operators; Access speech; capture spokenText; live audio | Text transformation/recorded audio verified; actual installed Hebrew voice pronunciation pending |
| Spotlight, autosave, submission, resumability | outline spotlight per later instruction; recovery/conflict/corrections and live workflow tests | Automated workflow verified |
| AAC help/clarification/break/finished dock | student AAC source and access workflow | Implemented; actual assistive-device operation pending |
| Teacher marks, return/retry, stickers, 15-second recording | review source, API duration bound, marking/corrections tests, live voice workflow | Automated lifecycle verified; natural microphone recording on participant phone pending |
| Account-free parent view, listen and acknowledge | parent routes/UI; live workflow and revocation assertions | Automated workflow verified |
| Calm palette and personal preferences | three themes, direct menu, theme scans and persisted preference tests | Automated contrast/state checks; student comfort preference needs observation |
| 64px standard-tablet / 88px assistive targets, 20px gaps, 48px primary edge clearance | assistive-spacing regression found 6px key gaps; CSS corrected; seven targeted browser tests passed | Key geometry and submission edge clearance verified at 320/390/768px; not a whole-product geometry certification |
| 800–1500ms dwell, progress/cancel/pause; no duplicate app/device dwell | validated preferences, interaction state-machine tests, app dwell/touch browser tests | Software behavior verified; actual device dwell integration pending |
| Keyboard and two-switch entry/correction | `access.spec.ts`, keyboard regression suite | Emulated keyboard switches verified; physical switch hardware pending |
| Eye-gaze and switch on actual participant devices | No actual-device evidence provided; `adb` unavailable on this workstation | **Not achieved: requires device/operator access** |
| Teacher/student permissions and protected sessions | auth/loadActor; API and classroom isolation tests | Automated authorization verified |
| Persistent source/answers/preferences/audio/acknowledgement | D1/media code, API lifecycle and live tests; fresh `node scripts/smoke-production.mjs` run passed on current build | Current answer/session persistence across worker restart verified; synthetic account removed |
| Draft → assigned → in progress → submitted → reviewed/returned → acknowledged | guarded server transitions; workflow/corrections tests | Automated transitions verified |
| Recoverable saves/uploads/OCR failures and retry | recovery/conflict and local recognition cancellation tests; visible useAction errors | Tested failure paths; all device/network combinations not established |
| Expiring/revocable assignment-scoped parent links | assignments/media authorization; expiry/revocation API/live tests | Automated restrictions verified |
| Teacher-initiated WhatsApp/share/copied link | explicit share link and clipboard actions in review UI | Link generation/copy present; actual WhatsApp handoff on phone pending |
| Downloadable/printable completed answers and feedback | export/WorkRecord, export tests, live download assertions | HTML with audio verified; physical print and accessible PDF are not claimed |
| Consent, deletion and minimal measurements; no background capture | consent checks, account/student deletion tests, observation route, explicit recorder/camera actions | Software controls verified; school consent/retention execution is a field responsibility |
| Adult confirmation and teacher authority | confirmation gate, manual correct/retry decisions | Automated gating verified; no automatic grading |

## Field gates and outcomes still unproven

The brief proposes four weeks after readiness, 10–15 students, 3–5 teachers/therapists and parents, and at least three short assignments per student weekly. No recruitment, actual participant baseline or four-week observation results have been supplied. `pilot-protocol.md` defines the procedure; `pilot/metrics.ts` and the observation/export screens support measurement. Their existence does not prove outcomes.

| Original outcome target | Evidence needed |
| --- | --- |
| ≥80% reach review without a technical blocker | Actual assigned/reviewed lifecycle records reconciled with assignment incident log |
| ≥30% fewer interface interventions | Paired baseline/app observations per student and input mode, teaching help separate |
| ≥90% no extra worksheet/editor app | Actual session observations, excluding established assistive tools |
| Median preparation ≤180 seconds | Capture-to-confirm timing including OCR corrections on actual assignments |
| Median marking ≤10 seconds/exercise | Marking timing separated from reading and recording |
| ≥70% parent acknowledgement within 48 hours | Actual shares/acknowledgements with still-open windows excluded |
| No unresolved saved-work loss, access defect or blocking navigation | Device-specific acceptance plus incident log and regression evidence |

The original definition of done explicitly names a participating student using their configured access method. Synthetic browser success does not satisfy that participant-specific gate. The active goal is therefore **not proven complete**. Requested device models, assistive tools and a teacher/therapist operator; no new participant data should be invented or obtained by messaging others without authorization.

## Audit-turn verification

Corrected assistive keypad spacing after a failing regression measured 6px rather than 20px. Seven local spacing/access/keyboard scenarios passed, plus the new PDF-page browser scenario, production build and current restart persistence smoke. Four live spacing/keyboard scenarios passed on Worker `f71539cc-eb0d-4266-8d45-efe24ec501e5`; synthetic accounts cleaned up. No schema change. Actual participant hardware remains unavailable; this is the first explicit blocker-audit turn, not grounds to mark the entire goal achieved or blocked yet.

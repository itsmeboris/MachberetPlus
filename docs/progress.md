# Execution ledger

Plan: docs/superpowers/plans/2026-10-30-machberet-pilot.md. Scope: docs/pilot-brief.txt.

User chose the Android web pilot and waived further design questions. Fresh repository initialized on pilot-web; supplied PRD and Stitch references preserved. Implementation ran inline, followed by an independent review whose five material findings were addressed.

Tasks 1–4 implemented locally: persistent authorized API, teacher/parent capture and correction, accessible student workbook with recovery, review and parent acknowledgement. Task 5 observation/report/export and field protocol implemented. Verification: 22 unit/API tests, 10 browser tests, production build and worker-restart persistence smoke passed.

Cloudflare login is verified. Created production D1, applied five migrations, and deployed the worker at https://machberet-pilot.machberet-pilot.workers.dev. Published main to https://github.com/itsmeboris/MachberetPlus. Fresh local verification: 22 unit/API tests, 10 browser tests and build passed. Live acceptance passed in 43.4s, including scanned source, OCR, teacher confirmation, student resume, voice feedback, parent acknowledgement, download, redeploy persistence, revocation and synthetic-account cleanup. Verified version: a9c53f07-0bf2-4aad-9a5f-b94099be951f. Actual participant Android/gaze/switch testing, representative OCR evaluation and field outcomes remain outstanding. See readiness.md, deployment.md and pilot-protocol.md.

Screenshots: artifacts/teacher-desktop.png and artifacts/student-mobile.png. Automated tests use synthetic data and separate local databases. Production smoke cleans up its account. Original references remain untouched.

## User feedback update

Implemented classrooms/bulk roster/class-wide assignment progress, persistent audience and safe delivery retries, seven-day reusable student links with copy/share/renew/revoke, visible password guidance, interactive crop/rotation, simpler Hebrew feedback controls, optional exercise instructions and cloud handwriting recognition. Both original photos transcribed correctly via direct model benchmark and the deployed browser flow. Google/Microsoft activation deferred by user's explicit reply; provider setup documented for later.

Verified: 35 unit/API tests, 13 local browser tests, production build, independent review and 3 live browser scenarios passed. Additive migration 0006 applied; original two production users retained after synthetic cleanup. Deployed version d54f67bc-72e8-45a8-81bd-35cfda628c49. Private photos remain outside git. Full branch review's two material findings fixed and approved on re-review.

## Phone and review update — 2026-10-31

Implemented compact decimal keypad, labeled optional math symbols, explicit accessibility-mode explanations, reactive spotlight, touch fallback during dwell, student withdrawal/correction/resubmission, per-exercise correct/retry/unmarked decisions and teacher return of reviewed work. Returning work revokes parent links, clears acknowledgement and guards concurrent sharing/acknowledgement. Removed misleading speech/help symbols. Recognition costs documented using current official pricing; local OCR remains available.

Verified 39 unit/API tests, 18 local browser tests, build, independent review and six live scenarios across targeted runs. Deployed version `db8b2031-3811-4768-9535-a96d64e81d25`; no schema change. Live test-harness header and async completion assumptions corrected. Synthetic accounts cleaned up; actual device checks remain a field task.

## Free handwriting research and implementation

Researched Pix2Text, TrOCR, PP-FormulaNet, SmolVLM and Hebrew-specific Mishkefet. Benchmarked quantized Pix2Text v1 (misread final digit) and selected MIT-licensed Pix2Text-MFR-1.5. Implemented a pinned cached on-device WASM worker, bounded page/line preparation, progress/cancel, protected edits and no automatic paid fallback. Both uncropped original photos produced all six equations correctly in development and live browser flows. Not a Hebrew prose recognizer; scope and alternatives documented in free-handwriting.md.

69 unit/API tests, 21 browser tests, build and independent review passed. Live photo test passed with no inference upload and the model host blocked for cached second-photo recognition (19.8s/4.0s desktop timings). Deployed `1a8c25d8-fd1e-4440-b3eb-f94e84014dd1` without database changes. New runtime is lazy-loaded; first-use total is about 135 MB. Synthetic account cleaned up, photos/models outside Git, Android hardware performance still needs field testing.

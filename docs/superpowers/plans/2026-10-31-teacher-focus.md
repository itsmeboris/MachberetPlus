# Teacher-directed focus sessions

User requests classroom interaction that lets the teacher dim distractions for an individual student and emphasize their questions/answers. Prior waiver of design questions applies.

Design: teacher manually starts/stops a five-minute session per student from a selected classroom. Poll every five seconds while visible, with immediate refresh on returning to the tab. Server-authorized, expiring state is separate from personal accessibility preferences. Student acknowledges receipt, can dismiss, and retains keyboard focus/answers. Teacher sees requested/received/ended state, not a fabricated attention score. This acts only inside Machberet; no gaze/camera monitoring or other-app/OS control.

Rendering: dim the page background around the active question or mission. Keep question/answer, help, navigation, theme/access controls and an explicit end-focus banner readable and operable. No pointer interception, forced navigation, animation or keyboard trapping. Honor forced colors and print. Automatically clear the local mask at expiry even without connectivity; stale requests cannot cancel a newer request.

Implementation: migration 0007 holds one current request per student with ownership, unique request ID, expiry, receipt and end reason. Add isolated `/api/focus` routes, student focus controller and classroom controls. Use server time to derive a bounded client duration. No assignment data or preference changes.

Verification: API authorization/isolation/expiry/stale acknowledgement/dismissal tests first; browser teacher/student interaction with draft/focus preservation, student dismissal, stop, receipt and offline expiry. Axe scans and all three palettes with overlay; build and existing interaction regressions. Independent final review, additive migration, live smoke, publish source and evidence.

Implementation ledger: API tests first failed against missing routes, then passed. Final unit/API suite: 72 passing; production build passes. Two focus browser scenarios pass locally, including three-theme axe scans, forced-colors mode, typing/focus preservation, teacher receipt/stop, student dismissal, submitted-work navigation, offline expiry and dismissal persistence across reload. Classroom and two external-input regressions also passed. Independent review found dimmed read-only navigation and lost offline dismissal; both were fixed and covered. Browser testing additionally caught a forced-colors selector specificity issue, now fixed.

Ruling: remember the last 20 dismissed request IDs per user in browser storage and retry a matching dismissal on refresh/reconnection. This handles reloads without retaining answers or attention data. Only a new teacher request ID can re-enable focus. Browser storage denial leaves the in-memory fallback.

Deployment: exported the production database before additive migration 0007. Direct local D1 import exposed export table-order constraints; restored the export to an isolated SQLite database and verified integrity and foreign keys instead. Private backup and restore databases remain ignored under .superpowers. Migration applied successfully; deployed worker c1ea6bbb-8a7f-4453-ac49-c20c69f3d8df. Actual participant/OptiKey hardware testing remains outstanding.

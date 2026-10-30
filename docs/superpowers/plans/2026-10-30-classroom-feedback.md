# Classroom and usability feedback implementation plan

User feedback in this conversation is the spec. User previously waived further design questions. Continue within the existing React/Hono/D1 platform and deploy verified fixes. Work on classroom-feedback branch; preserve existing production records and supplied private photos outside git.

## Design decisions
- A classroom owns a teacher-managed roster. Prepare one named assignment with many exercises, distribute once to the roster, and retain isolated per-student answers/review. Existing individual assignments remain supported. Later roster changes must not silently disclose or overwrite work.
- Student access links become reusable for seven days, with copy/share and explicit renewal/revocation. A generic classroom link must not let students impersonate peers.
- Google and Microsoft OIDC integrations require configured credentials, nonce/state/PKCE and verified token identity. No fake active sign-in buttons or automatic linking based on an unverified email. Email/password remains usable with a visible twelve-character requirement.
- Replace crop coordinate entry with four draggable corners, keyboard adjustment and simple quarter-turn rotation. Preserve original source until changes apply.
- Keep printed-page local OCR; add an explicitly disclosed cloud vision option for handwritten/mixed worksheets. Benchmark both user photos, not a hardcoded transcription. Require adult confirmation; never auto-grade.
- Plain Hebrew review copy, clear assignment-vs-exercise labels; only assignment needs a name. Exercises need content, not names.

## Tasks and ownership
1. Classroom domain and dashboard: migrations/0006_classrooms.sql, server/classrooms.ts, server/students.ts, class-related server/assignments.ts and server/media.ts changes, src/features/Teacher.tsx, new classroom components. API supports roster create/add, class-wide distribution with shared source and isolated answers, ownership, idempotence, progress. Add integration tests with multiple students and another teacher. Parent/read media permissions must remain scoped. Root wires Capture class selection and route/types.
2. Authentication: server/auth.ts, src/features/Auth.tsx, dedicated tests/docs. Add visible password guidance and reusable seven-day student pairing. User explicitly deferred Google/Microsoft activation during implementation; prepare docs/oauth-setup.md only, with no OAuth migration or non-working provider buttons.
3. Image correction and review: src/features/capture/ImageEditor.tsx and geometry helpers/tests, src/features/review/Review.tsx and review-local styles. Drag/touch/keyboard corners with overlay; plain Hebrew controls and action explanations; retain feedback lifecycle protection. Do not edit Capture or global CSS; new isolated CSS permitted.
4. Root: recognition benchmark and cloud endpoint, Capture integration (class distribution, one assignment name, optional instructions per exercise), shared bindings/routes/types/styles, browser regression and integration review.
5. Full tests/build, independent review of permissions/identity/concurrency; remote additive migration, deploy, live synthetic classroom workflow, verify private user photos remain uncommitted, update evidence and push.

## Verification focus
Cross-teacher roster/distribution; one student's answers never exposed to peers; source/audio references remain valid after teacher draft distribution; repeat distribution doesn't duplicate; expiring/revoked pairing; OAuth replay/issuer/audience; no cloud recognition without explicit disclosure; both handwritten sample equations recognized as proposals; drag corners on touch and keyboard; no per-exercise title required.

## Execution evidence
- Local: 35 unit/API tests and 13 browser tests pass, production build passes.
- Independent review identified classroom intent lost on draft reopen and send retry revision handling. Both fixed and re-reviewed: selected audience persists, displayed individual matches saved recipient, pending delivery retries the same confirmed version without duplicating work.
- Bulk roster/distribution verified with 30 students. JSON-based bulk SQL avoids one/two queries per student and stays within the free worker query limit.
- Direct cloud vision benchmark correctly transcribed all three equations from both actual user photographs; private files remain outside Git. Live browser verification is recorded in readiness.md.
- Migration 0006 is additive. Existing production data is retained; a provider Time Travel bookmark was recorded before migration.

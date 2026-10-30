# Persistent deployment

`npx wrangler whoami` reports unauthenticated. No public URL or production database exists. `wrangler.jsonc` deliberately contains the placeholder `local-development`. Temporary hosting is not a persistent pilot deployment.

## Publish

```powershell
npx wrangler login
npx wrangler whoami
npx wrangler d1 create machberet-pilot
```

Copy the returned database ID into the existing `DB` binding in `wrangler.jsonc`. If the database already exists, use its verified ID instead. Preserve the binding and migrations directory.

```powershell
npx wrangler d1 migrations apply machberet-pilot --remote
npm run deploy
```

Record the HTTPS URL and worker version. Browser and API use the same origin. Source pages and audio live in private bounded D1 chunks; no public bucket or OCR service credentials are needed.

## Live acceptance

Use synthetic data and separate teacher/student/parent sessions. Capture, correct, confirm, assign, answer, reload, submit, record feedback, share, listen and acknowledge. Verify teacher acknowledgement, download audio-embedded HTML, revoke the link and check that both data and audio become inaccessible. Redeploy without replacing the database and verify saved work survives. Delete the synthetic account and verify student/parent access is invalidated. Record evidence in readiness.md.

On actual Android devices open the HTTPS URL in Chrome and use install/add-to-home-screen. Test camera, microphone and Hebrew speech on each device. LAN HTTP development URLs lack the secure context required by some capabilities.

## Operations

- Keep production D1 across deployments. Apply numbered migrations; never reset production storage to troubleshoot tests.
- Export a provider backup before schema changes and test restoration in a separate database. Treat backups as student data.
- Student/account deletion cascades through associated work, media and access. Downloaded copies and provider backups require separate retention handling.
- Sessions last seven days. Password reset and managed school identity are not implemented; agree an account-recovery procedure before onboarding.
- OCR downloads runtime/language data on first use; worksheet recognition itself runs locally. First use needs network access.
- Shell caching is not complete offline account support. An open workbook retains unsent answers locally, with retry and explicit conflict resolution; cold offline reload cannot authenticate.
- Do not log capability tokens, cookies, worksheet bodies or recordings. Plan storage capacity and retention before expanding beyond the pilot.

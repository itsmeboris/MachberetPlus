# Persistent deployment

The worker is deployed at `https://machberet-pilot.machberet-pilot.workers.dev` with persistent D1 database `c91e9d2b-2687-4a3e-985e-def29d37600b`. All six migrations are applied. Current version: `db8b2031-3811-4768-9535-a96d64e81d25` (2026-10-31). The mobile keyboard, correction and marking update required no database migration. The initial subdomain TLS provisioning delay resolved without changing application code. Verification details are in readiness.md.

Source repository: https://github.com/itsmeboris/MachberetPlus.

## Publish from another machine

```powershell
npx wrangler login
npx wrangler whoami
```

Use the existing database binding in `wrangler.jsonc`; do not recreate the production database.

```powershell
npx wrangler d1 migrations apply machberet-pilot --remote
npm run deploy
```

Record the HTTPS URL and worker version. Browser and API use the same origin. Source pages and audio live in private bounded D1 chunks; no public bucket or OCR service credentials are needed.

## Live acceptance

The opt-in browser suite creates and deletes only its own synthetic account. It exercises a scanned worksheet through voice feedback, download, acknowledgement and revocation. Set the redeploy flag only when intentionally verifying data persistence across a deployment:

```powershell
$env:PILOT_LIVE_URL='https://machberet-pilot.machberet-pilot.workers.dev'
$env:PILOT_VERIFY_REDEPLOY='1'
npm run test:live
```

Use synthetic data and separate teacher/student/parent sessions. Capture, correct, confirm, assign, answer, reload, submit, record feedback, share, listen and acknowledge. Verify teacher acknowledgement, download audio-embedded HTML, revoke the link and check that both data and audio become inaccessible. Redeploy without replacing the database and verify saved work survives. Delete the synthetic account and verify student/parent access is invalidated. Record evidence in readiness.md.

On actual Android devices open the HTTPS URL in Chrome and use install/add-to-home-screen. Test camera, microphone and Hebrew speech on each device. LAN HTTP development URLs lack the secure context required by some capabilities.

## Operations

- Keep production D1 across deployments. Apply numbered migrations; never reset production storage to troubleshoot tests.
- Export a provider backup before schema changes and test restoration in a separate database. Treat backups as student data.
- Student/account deletion cascades through associated work, media and access. Downloaded copies and provider backups require separate retention handling.
- Sessions last seven days. Password reset and managed school identity are not implemented; agree an account-recovery procedure before onboarding.
- OCR downloads runtime/language data on first use; worksheet recognition itself runs locally. First use needs network access.
- The above local OCR applies to printed-page mode. Photo/handwriting mode sends the explicitly approved image to the `AI` binding on Cloudflare Workers AI. Provider quotas apply; no provider secret is shipped to the browser. Local development uses the same remote AI service if this option is selected.
- Shell caching is not complete offline account support. An open workbook retains unsent answers locally, with retry and explicit conflict resolution; cold offline reload cannot authenticate.
- Do not log capability tokens, cookies, worksheet bodies or recordings. Plan storage capacity and retention before expanding beyond the pilot.

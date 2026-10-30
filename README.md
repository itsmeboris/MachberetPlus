# Machberet+ Android web pilot

Hebrew worksheet capture, teacher confirmation, accessible student work, voice feedback and account-free parent acknowledgement. React/Vite, Hono/Cloudflare Worker, D1 persistence, browser-local Hebrew OCR.

## Local setup

Node 24 was used for verification.

```powershell
npm ci
npx wrangler d1 migrations apply machberet-pilot --local
npm run build
npm run dev:api
```

Open `http://127.0.0.1:8787`. For frontend development, run `npm run dev` in another terminal and open `http://127.0.0.1:5173`.

Create a teacher account, add a consenting student and open the single-use student link in a separate browser profile. Capture a page or request a parent photo; correct OCR proposals, save, confirm and assign. Complete and submit as the student, review with a voice note, then share the reviewed assignment with the parent.

Parent photo links last one day and only upload to a draft; review links last seven days and expose one reviewed assignment. Both are revocable. Student entry links are single-use and expire after 15 minutes.

## Verification

```powershell
npm test
npm run build
npx playwright install chromium
npm run test:e2e
node scripts/smoke-production.mjs
```

Browser tests use `.wrangler/e2e`. Restart smoke uses `.wrangler/production-smoke`, verifies saved answers and sessions survive a worker restart, and deletes its synthetic account. Neither accesses remote D1.

Source is published at [MachberetPlus](https://github.com/itsmeboris/MachberetPlus). The [live pilot](https://machberet-pilot.machberet-pilot.workers.dev) passed the scanned-worksheet-to-parent workflow, persistence across redeployment, revocation and test-account cleanup on 2026-10-30. Open the HTTPS link on Android, create a teacher account and install through Chrome's install/add-to-home-screen action. See [deployment](docs/deployment.md), [readiness](docs/readiness.md) and [field protocol](docs/pilot-protocol.md). Actual participant Android/gaze/switch testing remains required. HTML downloads embed audio; printed/PDF copies contain written answers and feedback, not playable audio.

# Machberet+ Android web pilot

Hebrew worksheet capture, teacher confirmation, classroom distribution, accessible student work, voice feedback and account-free parent acknowledgement. React/Vite, Hono/Cloudflare Worker and D1. Printed-page OCR runs locally; handwritten/photo recognition uses Cloudflare Workers AI after explicit confirmation.

## Local setup

Node 24 was used for verification.

```powershell
npm ci
npx wrangler d1 migrations apply machberet-pilot --local
npm run build
npm run dev:api
```

Open `http://127.0.0.1:8787`. For frontend development, run `npm run dev` in another terminal and open `http://127.0.0.1:5173`.

Create a teacher account (any email address; password at least twelve characters), create a classroom and paste student names one per line with consent. Copy each student's personal link from the student-management section. Prepare one named assignment, add several exercises without naming each one, choose the classroom and distribute once. Every student receives independent answers and feedback, with progress grouped on the teacher dashboard. Individual assignments are still available.

For handwritten pages choose **צילום וכתב יד — זיהוי בענן** and confirm sending the image to Cloudflare. For clear printed pages, local OCR is available without that transfer. Drag the four image corners to the page edges, rotate if needed, then apply. Check all proposed content before assignment; recognition never grades or approves work automatically.

Parent photo links last one day and only upload to a draft; review links last seven days and expose one reviewed assignment. Student entry links are reusable for seven days; renewal invalidates the previous link, and teachers can revoke entry links. Link expiry does not terminate an already authenticated seven-day session. Google/Microsoft login remains a future task; [provider setup is documented](docs/oauth-setup.md).

The phone math keypad includes decimals, with labeled extra symbols behind a toggle. Standard mode uses compact keys; accessible modes retain large targets. Eye-pointer mode supports external pointer hardware, not camera eye tracking; dwell activation is configured separately. Students can reopen a submission before teacher feedback is saved. Teachers mark each answer correct, retry or unmarked, and can return reviewed work for corrections (revoking previous parent links). [Recognition costs and limitations](docs/recognition.md) are documented.

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

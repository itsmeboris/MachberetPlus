import { spawn, execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Dedicated synthetic database; never connects to remote D1 or deletes user data.
const cli = resolve("node_modules/wrangler/bin/wrangler.js");
const origin = "http://127.0.0.1:8789";
const persist = ".wrangler/production-smoke";
execFileSync(
  process.execPath,
  [
    cli,
    "d1",
    "migrations",
    "apply",
    "machberet-pilot",
    "--local",
    "--persist-to",
    persist,
  ],
  { stdio: "pipe", env: { ...process.env, CI: "true" } },
);
let worker;
let workerOutput = "";
async function start() {
  worker = spawn(
    process.execPath,
    [cli, "dev", "--port", "8789", "--persist-to", persist],
    { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  worker.stdout.on("data", (data) => {
    workerOutput += data;
  });
  worker.stderr.on("data", (data) => {
    workerOutput += data;
  });
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(origin)).ok) return;
    } catch {}
    if (worker.exitCode !== null) throw new Error(workerOutput);
    await delay(250);
  }
  throw new Error("Production worker did not start");
}
async function stop() {
  if (!worker || worker.exitCode !== null) return;
  const closed = new Promise((resolve) => worker.once("exit", resolve));
  worker.kill();
  await closed;
}
async function call(path, method = "GET", data, cookie = "") {
  const response = await fetch(origin + "/api" + path, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return {
    body: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
let teacherCookie;
try {
  await start();
  const registration = await call("/auth/register", "POST", {
    name: "מורה לבדיקת הפעלה",
    email: `runtime-${Date.now()}@example.test`,
    password: "runtime-test-password-2026",
    consent: true,
  });
  teacherCookie = registration.cookie;
  assert.ok(teacherCookie);
  const { body: student } = await call(
    "/students",
    "POST",
    { name: "תלמיד לבדיקה", consent: true },
    teacherCookie,
  );
  const { body: draft } = await call(
    "/assignments",
    "POST",
    {
      studentId: student.id,
      title: "בדיקת התמדה לאחר הפעלה מחדש",
      exercises: [
        {
          id: "q1",
          kind: "arithmetic",
          prompt: "פתרו",
          math: "12 + 3",
          spokenText: "",
        },
      ],
    },
    teacherCookie,
  );
  const { body: confirmed } = await call(
    `/assignments/${draft.id}`,
    "PATCH",
    { confirmed: true, contentRevision: 0 },
    teacherCookie,
  );
  await call(
    `/assignments/${draft.id}/transition`,
    "POST",
    { action: "assign", contentRevision: confirmed.contentRevision },
    teacherCookie,
  );
  const { cookie: studentCookie } = await call("/auth/student", "POST", {
    code: student.code,
  });
  await call(
    `/assignments/${draft.id}/answers`,
    "PUT",
    { revision: 0, answers: { q1: { text: "15" } } },
    studentCookie,
  );
  for (const path of ["/manifest.webmanifest", "/sw.js", "/icon-192.png"])
    assert.ok((await fetch(origin + path)).ok, path);
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
    });
    const [name, ...value] = teacherCookie.split("=");
    await context.addCookies([{ name, value: value.join("="), url: origin }]);
    const page = await context.newPage();
    await page.goto(origin);
    await page.getByRole("heading", { name: "סביבת המורה" }).waitFor();
    await page.screenshot({
      path: "artifacts/teacher-desktop.png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }
  await stop();
  await start();
  const { body: restored } = await call(
    `/assignments/${draft.id}`,
    "GET",
    undefined,
    studentCookie,
  );
  assert.equal(restored.answers.q1.text, "15");
  assert.equal(restored.revision, 1);
  await call("/account", "DELETE", {}, teacherCookie);
  teacherCookie = undefined;
  console.log(
    "PASS: built assets, authenticated workflow, answer/session persistence after worker restart, account cleanup.",
  );
} finally {
  if (teacherCookie) {
    try {
      await call("/account", "DELETE", {}, teacherCookie);
    } catch {}
  }
  await stop();
}

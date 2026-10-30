import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
test("live scanned worksheet, voice feedback, acknowledgement, redeploy persistence and revocation", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "יצירת חשבון מורה" }).click();
  await page.getByLabel("שם").fill("מורה לבדיקה");
  await page
    .getByLabel("דואר אלקטרוני")
    .fill(`teacher-${Date.now()}@example.test`);
  await page.getByLabel("סיסמה").fill("pilot-test-password-2026");
  await page.getByLabel("אני מסכימ").check();
  await page.getByRole("button", { name: "יצירת החשבון", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "סביבת המורה" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "הוספת תלמיד" }).click();
  await page.getByLabel("שם התלמיד").fill("תלמיד לבדיקה");
  await page.getByLabel("קיבלתי הסכמת").check();
  await page.getByRole("button", { name: "שמירת התלמיד" }).click();
  const pair = await page.getByLabel("קישור כניסה לתלמיד").inputValue();
  await page.getByRole("button", { name: "משימה חדשה" }).click();
  await page.getByLabel("שם המשימה").fill("חיבור עד עשרים");
  await page.getByLabel("נוסח השאלה").fill("כמה הם שתים עשרה ועוד שלוש?");
  await page.getByLabel("ביטוי מתמטי").fill("12 + 3");
  await page.getByRole("button", { name: "שמירת טיוטה" }).click();
  await page.getByLabel("בדקתי את כל התרגילים").check();
  await page.getByRole("button", { name: "שליחת המשימה לתלמיד" }).click();
  const studentContext = await browser.newContext();
  const student = await studentContext.newPage();
  await student.goto(pair);
  await student.getByRole("button", { name: "כניסה למשימות שלי" }).click();
  await student.getByRole("button", { name: "התחל עבודה" }).click();
  await student.getByLabel("התשובה שלי").fill("15");
  await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await student.reload();
  await student.getByRole("button", { name: "המשך עבודה" }).click();
  await expect(student.getByLabel("התשובה שלי")).toHaveValue("15");
  await student.getByRole("button", { name: "הגשה למורה" }).click();
  await page.reload();
  await page.getByRole("button", { name: "בדיקת העבודה" }).click();
  await expect(page.getByText("15", { exact: true })).toBeVisible();
  await page.getByLabel("משוב כתוב").fill("כל הכבוד");
  await page.context().grantPermissions(["microphone"]);
  await page.getByRole("button", { name: "הקלטת הודעה" }).click();
  await expect(
    page.getByRole("button", { name: "סיום הבדיקה" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /עצירת ההקלטה/ }),
  ).toContainText("2");
  await page.getByRole("button", { name: /עצירת ההקלטה/ }).click();
  await expect(
    page.getByRole("button", { name: "סיום הבדיקה" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "שמירת ההקלטה" }).click();
  await expect(
    page.getByRole("button", { name: "ההקלטה נשמרה" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "סיום הבדיקה" }).click();
  await page.getByRole("button", { name: "יצירת קישור להורה" }).click();
  const link = await page.getByLabel("קישור להורה").inputValue();
  const parentContext = await browser.newContext();
  const parent = await parentContext.newPage();
  await parent.goto(link);
  await expect(parent.getByText("כל הכבוד", { exact: true })).toBeVisible();
  await expect(parent.locator("audio")).toHaveCount(1);
  await parent
    .locator("audio")
    .evaluate((audio: HTMLAudioElement) => audio.load());
  await expect
    .poll(() =>
      parent
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await parent.getByRole("button", { name: "עברנו יחד על הדף" }).click();
  await expect(parent.getByText("האישור נשמר. תודה!")).toBeVisible();
  const downloadPromise = parent.waitForEvent("download");
  await parent.getByRole("button", { name: "הורדת העבודה והמשוב" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const html = Buffer.concat(chunks).toString("utf8");
  expect(html).toContain("data:audio/");
  expect(html).toContain("כל הכבוד");
  await page.reload();
  await expect(page.getByText("עברו יחד בבית", { exact: true })).toBeVisible();
  await parent.setViewportSize({ width: 390, height: 844 });
  await parent.screenshot({
    path: "artifacts/live-parent-mobile.png",
    fullPage: true,
  });
  const origin = new URL(page.url()).origin;
  const before = await (
    await page.request.get(origin + "/api/assignments")
  ).json();
  expect(before).toHaveLength(1);
  const assignment = before[0];
  expect(assignment.sourceId).toBeTruthy();
  expect(assignment.acknowledgedAt).toBeTruthy();
  expect(assignment.status).toBe("parent_acknowledged");
  const audioId = Object.values(assignment.feedback)
    .map((f: any) => f.audioId)
    .find(Boolean);
  expect(audioId).toBeTruthy();
  if (process.env.PILOT_VERIFY_REDEPLOY === "1") {
    const result = await promisify(execFile)(
      process.execPath,
      [resolve("node_modules/wrangler/bin/wrangler.js"), "deploy"],
      { timeout: 120000, windowsHide: true },
    );
    console.log(result.stdout);
  }
  const restored = await (
    await page.request.get(origin + "/api/assignments/" + assignment.id)
  ).json();
  expect(restored.answers).toEqual(assignment.answers);
  expect(restored.feedback).toEqual(assignment.feedback);
  expect(restored.acknowledgedAt).toEqual(assignment.acknowledgedAt);
  const source = await page.request.get(
    origin + "/api/media/" + assignment.sourceId,
  );
  expect(source.ok()).toBeTruthy();
  expect((await source.body()).length).toBeGreaterThan(100);
  const token = new URL(link).pathname.slice(3);
  const audioUrl = origin + "/api/parent/" + token + "/media/" + audioId;
  expect((await parent.request.get(audioUrl)).ok()).toBeTruthy();
  const revoked = await page.request.delete(
    origin + "/api/assignments/" + assignment.id + "/parent-links",
    { headers: { Origin: origin }, data: {} },
  );
  expect(revoked.ok()).toBeTruthy();
  expect(
    (await parent.request.get(origin + "/api/parent/" + token)).status(),
  ).toBe(404);
  expect((await parent.request.get(audioUrl)).status()).toBe(404);
  const deleted = await page.request.delete(origin + "/api/account", {
    headers: { Origin: origin },
    data: {},
  });
  expect(deleted.ok()).toBeTruthy();
  expect((await student.request.get(origin + "/api/auth/me")).status()).toBe(
    401,
  );
  await studentContext.close();
  await parentContext.close();
});

// Cleanup only the account created by this test, including on an assertion failure.
test.afterEach(async ({ page }) => {
  if (!page.url().startsWith("https://")) return;
  const origin = new URL(page.url()).origin;
  const response = await page.request.delete(origin + "/api/account", {
    headers: { Origin: origin },
    data: {},
  });
  expect([200, 401]).toContain(response.status());
});

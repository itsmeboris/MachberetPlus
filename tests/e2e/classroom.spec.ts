import { test, expect } from "@playwright/test";
test("one named assignment with unnamed exercises reaches the whole classroom with separate progress", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post(origin + "/api/auth/register", {
    headers: { Origin: origin },
    data: {
      email: `class-ui-${Date.now()}@example.test`,
      password: "class-test-password-2026",
      name: "מורה",
      consent: true,
    },
  });
  expect(response.ok()).toBeTruthy();
  await page.reload();
  await page.getByLabel("שם כיתה חדשה").fill("כיתה א");
  await page.getByRole("button", { name: "יצירת כיתה", exact: true }).click();
  await page.getByLabel("תלמידים חדשים — שם אחד בכל שורה").fill("דנה\nאורי");
  await page.getByLabel("קיבלתי הסכמת הורה או אפוטרופוס לכל תלמיד").check();
  await page.getByRole("button", { name: "הוספת התלמידים לכיתה" }).click();
  await expect(page.getByLabel("צירוף תלמיד קיים")).toBeVisible();
  await page.getByText(/קישורי כניסה וניהול תלמידים/).click();
  await page.getByRole("button", { name: "חידוש קישור אישי — קישור כניסה עבור דנה" }).click();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const link = await page.getByLabel("קישור כניסה לתלמיד").inputValue();
  await page.getByRole("button", { name: "העתקת הקישור", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await page.getByRole("button", { name: "משימה חדשה" }).click();
  await page.getByLabel("שם המשימה").fill("משוואות בכיתה");
  const classes = await (
    await page.request.get(origin + "/api/classrooms")
  ).json();
  await page.getByLabel("למי המשימה מיועדת?").selectOption(classes[0].id);
  await page.getByLabel("ביטוי מתמטי").fill("x + 5 = 12");
  await page.getByRole("button", { name: "הוספת תרגיל ידני" }).click();
  await page.getByLabel("ביטוי מתמטי").nth(1).fill("2x + 7 = 8");
  await page.getByRole("button", { name: "שמירת טיוטה" }).click();
  await expect(page.getByRole("status")).toContainText("הטיוטה נשמרה");
  await page.getByRole("button", { name: "חזרה למשימות" }).click();
  await page.getByRole("button", { name: "המשך הכנה" }).click();
  await expect(page.getByLabel("למי המשימה מיועדת?")).toHaveValue(
    classes[0].id,
  );
  await page.getByLabel("בדקתי את כל התרגילים").check();
  let interrupted = false;
  await page.route("**/api/assignments/*/distribute", async (route) => {
    if (!interrupted) {
      interrupted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "שליחת המשימה לכל הכיתה" }).click();
  await expect(
    page.getByRole("button", { name: "ניסיון נוסף בשליחת המשימה" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "ניסיון נוסף בשליחת המשימה" }).click();
  await expect(page.getByRole("button", { name: "משימה חדשה" })).toBeVisible();
  const assignments = await (
    await page.request.get(origin + "/api/assignments")
  ).json();
  const copies = assignments.filter((a: any) => a.distributionId);
  expect(copies).toHaveLength(2);
  expect(copies.every((a: any) => a.exercises.length === 2)).toBeTruthy();
  const context = await browser.newContext();
  try {
    const pairing = await (
      await page.request.post(
        origin + "/api/students/" + copies[0].studentId + "/pair",
        { headers: { Origin: origin }, data: {} },
      )
    ).json();
    const student = await context.newPage();
    await student.goto(origin + "/?join=" + pairing.code);
    await student.getByRole("button", { name: "כניסה למשימות שלי" }).click();
    await student.getByRole("button", { name: "התחל עבודה" }).click();
    await student.getByLabel("התשובה שלי").fill("7");
    await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
    const peer = await (
      await page.request.get(origin + "/api/assignments/" + copies[1].id)
    ).json();
    expect(peer.answers).toEqual({});
    await page.reload();
    await page.screenshot({
      path: "artifacts/classroom-progress.png",
      fullPage: true,
    });
  } finally {
    await context.close();
    await page.request.delete(origin + "/api/account", {
      headers: { Origin: origin },
      data: {},
    });
  }
});

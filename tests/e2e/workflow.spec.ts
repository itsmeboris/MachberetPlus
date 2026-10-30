import { test, expect } from "@playwright/test";
test("teacher assigns, student saves and resumes, teacher reviews, parent acknowledges", async ({
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
  await expect(page.getByLabel("הערה כתובה")).toBeHidden();
  await page
    .getByText("הוספת הערה לתרגיל 1 (לא חובה)", { exact: true })
    .click();
  await page.getByLabel("הערה כתובה").fill("כל הכבוד");
  await page.context().grantPermissions(["microphone"]);
  await page.getByRole("button", { name: "הקלטת הודעה" }).click();
  await expect(
    page.getByRole("button", { name: "סיום הבדיקה" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "החזרה לתיקון", exact: true }),
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
  await studentContext.close();
  await parentContext.close();
});

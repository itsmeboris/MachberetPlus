import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";
test("uploads a real Hebrew worksheet and preserves its source after saving", async ({
  page,
  browser,
}) => {
  const { context } = await studentFixture(page, browser);
  await page.goto("/");
  await page.getByRole("button", { name: "משימה חדשה" }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("tests/fixtures/hebrew-worksheet.png");
  await expect(page.getByAltText("דף המקור")).toBeVisible();
  await page.getByLabel("שם המשימה").fill("דף מצולם");
  await page.getByLabel("נוסח השאלה").fill("פתרו");
  await page.getByLabel("ביטוי מתמטי").fill("12 + 3");
  await page.getByRole("button", { name: "שמירת טיוטה" }).click();
  await expect(page.getByRole("status")).toContainText("הטיוטה נשמרה");
  await expect
    .poll(() =>
      page
        .getByAltText("דף המקור")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.getByAltText("דף המקור")).toHaveAttribute(
    "src",
    /\/api\/media\//,
  );
  await context.close();
});
test("recognizes printed Hebrew and math locally for adult correction", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const { context } = await studentFixture(page, browser);
  await page.goto("/");
  await page.getByRole("button", { name: "משימה חדשה" }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("tests/fixtures/hebrew-worksheet.png");
  await page.getByRole("button", { name: "זיהוי תרגילים מהדף" }).click();
  await expect(page.getByRole("status")).toContainText("הזיהוי הושלם", {
    timeout: 150000,
  });
  expect(await page.getByLabel("נוסח השאלה").count()).toBeGreaterThan(1);
  const math = await page
    .getByLabel("ביטוי מתמטי")
    .evaluateAll((inputs) =>
      inputs.map((el) => (el as HTMLInputElement).value).join(" "),
    );
  expect(math).toContain("12");
  expect(math).toContain("3");
  await context.close();
});
test("a parent sends a photographed page into a teacher draft without an account", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const { context } = await studentFixture(page, browser);
  await page.goto("/");
  await page.getByRole("button", { name: "בקשת צילום מהורה" }).click();
  const link = await page.getByLabel("קישור לצילום בבית").inputValue();
  const parentContext = await browser.newContext();
  const parent = await parentContext.newPage();
  await parent.goto(link);
  await parent
    .locator("input[type=file]")
    .first()
    .setInputFiles("tests/fixtures/hebrew-worksheet.png");
  await parent.getByRole("button", { name: "שליחת הדף למורה" }).click();
  await expect(parent.getByRole("status")).toContainText("הדף נשלח למורה");
  await page.reload();
  await page.getByRole("button", { name: "המשך הכנה" }).click();
  await expect(page.getByAltText("דף המקור")).toHaveAttribute(
    "src",
    /\/api\/media\//,
  );
  await page.getByRole("button", { name: "זיהוי תרגילים מהדף" }).click();
  await expect(page.getByRole("status")).toContainText("הזיהוי הושלם", {
    timeout: 150000,
  });
  expect(await page.getByLabel("נוסח השאלה").count()).toBeGreaterThan(1);
  await page.getByRole("button", { name: "שמירת טיוטה" }).click();
  await expect(page.getByRole("status")).toContainText("הטיוטה נשמרה");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "שליחת המשימה לתלמיד" }).click();
  await expect(page.getByRole("button", { name: "משימה חדשה" })).toBeVisible();
  await parent.reload();
  await expect(parent.getByRole("alert")).toBeVisible();
  await context.close();
  await parentContext.close();
});

import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";

test("local recognition can cancel or fail without replacing teacher edits or falling back to cloud", async ({
  page,
  browser,
}) => {
  const { context } = await studentFixture(page, browser);
  await context.close();
  await page.goto("/");
  await page.getByRole("button", { name: "משימה חדשה" }).click();
  await page.getByLabel("ביטוי מתמטי").fill("7+8=15");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("tests/fixtures/hebrew-worksheet.png");
  const writes: string[] = [];
  page.context().on("request", (request) => {
    if (request.method() === "POST") writes.push(request.url());
  });
  let release: () => void = () => {};
  const stalled = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.context().route("https://huggingface.co/**", async (route) => {
    await stalled;
    await route.abort().catch(() => {});
  });
  await page.getByRole("button", { name: "זיהוי תרגילים מהדף" }).click();
  await expect(
    page.getByRole("button", { name: "ביטול הזיהוי" }),
  ).toBeVisible();
  await expect(page.getByLabel("ביטוי מתמטי")).toBeDisabled();
  await page.getByRole("button", { name: "ביטול הזיהוי" }).click();
  await expect(page.getByRole("status")).toContainText("הזיהוי בוטל");
  await expect(page.getByLabel("ביטוי מתמטי")).toHaveValue("7+8=15");
  release();
  await page.context().unrouteAll({ behavior: "wait" });
  await page
    .context()
    .route("https://huggingface.co/**", (route) => route.abort());
  await page.getByRole("button", { name: "זיהוי תרגילים מהדף" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "לא ניתן להפעיל את הזיהוי במכשיר",
  );
  await expect(page.getByLabel("ביטוי מתמטי")).toHaveValue("7+8=15");
  await expect(page.getByLabel("ביטוי מתמטי")).toBeEnabled();
  expect(writes).toEqual([]);
});

test("leaving during saved-source loading aborts recognition before starting a worker", async ({
  page,
  browser,
}) => {
  const { context } = await studentFixture(page, browser);
  await context.close();
  await page.goto("/");
  await page.getByRole("button", { name: "משימה חדשה" }).click();
  await page.getByLabel("שם המשימה").fill("בדיקת ביטול");
  await page.getByLabel("ביטוי מתמטי").fill("7+8=15");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("tests/fixtures/hebrew-worksheet.png");
  await page.getByRole("button", { name: "שמירת טיוטה" }).click();
  await expect(page.getByRole("status")).toContainText("הטיוטה נשמרה");
  let release: () => void = () => {};
  const stalled = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.context().route("**/api/media/*", async (route) => {
    if (route.request().resourceType() !== "fetch") return route.continue();
    const response = await route.fetch();
    await stalled;
    await route.fulfill({ response }).catch(() => {});
  });
  let workers = 0;
  page.on("worker", () => workers++);
  const fetching = page.waitForRequest(
    (request) =>
      request.url().includes("/api/media/") &&
      request.resourceType() === "fetch",
  );
  await page.getByRole("button", { name: "זיהוי תרגילים מהדף" }).click();
  const request = await fetching;
  const failed = page.waitForEvent("requestfailed", (r) => r === request);
  await page.getByRole("button", { name: "חזרה למשימות" }).click();
  await failed;
  release();
  await page.context().unrouteAll({ behavior: "wait" });
  await expect(
    page.getByRole("heading", { name: "סביבת המורה" }),
  ).toBeVisible();
  expect(workers).toBe(0);
});

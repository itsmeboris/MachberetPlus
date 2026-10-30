import { test, expect, type Page } from "@playwright/test";
import { studentFixture } from "./helpers";
async function scanTo(page: Page, label: string) {
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press("Space");
    const selected = page.locator(".switch-target");
    if (
      (await selected.count()) &&
      (((await selected.getAttribute("aria-label")) ?? "").trim() === label ||
        ((await selected.textContent()) ?? "").trim() === label)
    ) {
      await page.keyboard.press("Enter");
      return;
    }
  }
  throw new Error(`Switch target not reached: ${label}`);
}
test("two switches navigate keyboard groups, enter and correct an answer on Android-sized layout", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  const preferences = await student.request.put(
    "http://127.0.0.1:5173/api/preferences",
    {
      headers: { Origin: "http://127.0.0.1:5173" },
      data: {
        mode: "switch",
        dwellMs: 1000,
        dwellSource: "off",
        spotlight: false,
      },
    },
  );
  expect(preferences.status()).toBe(200);
  await student.reload();
  await expect(
    student.getByRole("button", { name: "התחל עבודה" }),
  ).toBeVisible();
  const button = await student
    .getByRole("button", { name: "התחל עבודה" })
    .boundingBox();
  expect(button!.width).toBeGreaterThanOrEqual(88);
  expect(button!.height).toBeGreaterThanOrEqual(88);
  await scanTo(student, "התחל עבודה ←");
  await expect(student.getByLabel("התשובה שלי", { exact: true })).toBeVisible();
  await scanTo(student, "ספרות 1 עד 3");
  // Selecting a group focuses its first key. Select 1, then scan the next row to 5.
  await student.keyboard.press("Enter");
  await scanTo(student, "ספרות 4 עד 6");
  await student.keyboard.press("Space");
  await student.keyboard.press("Enter");
  await expect(student.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "15",
  );
  await scanTo(student, "אפס נקודה ומחיקה");
  await student.keyboard.press("Space");
  await student.keyboard.press("Space");
  await student.keyboard.press("Enter");
  await expect(student.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "1",
  );
  await scanTo(student, "ספרות 4 עד 6");
  await student.keyboard.press("Space");
  await student.keyboard.press("Enter");
  await expect(student.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "15",
  );
  const overflow = await student.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  await scanTo(student, "השהיית הפעלה");
  await expect(
    student.getByRole("button", { name: "המשך הפעלה" }),
  ).toBeVisible();
  await student.keyboard.press("Enter");
  await expect(
    student.getByRole("button", { name: "השהיית הפעלה" }),
  ).toBeVisible();
  await student.screenshot({
    path: "artifacts/student-mobile.png",
    fullPage: true,
  });
  await context.close();
});
test("app dwell can pause and resume without a mouse click", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  const result = await student.request.put(
    "http://127.0.0.1:5173/api/preferences",
    {
      headers: { Origin: "http://127.0.0.1:5173" },
      data: {
        mode: "gaze",
        dwellMs: 800,
        dwellSource: "app",
        spotlight: false,
      },
    },
  );
  expect(result.status()).toBe(200);
  await student.reload();
  await student.getByRole("button", { name: "השהיית הפעלה" }).hover();
  await expect(
    student.getByRole("button", { name: "המשך הפעלה" }),
  ).toBeVisible();
  await student.mouse.move(0, 0);
  await student.getByRole("button", { name: "המשך הפעלה" }).hover();
  await expect(
    student.getByRole("button", { name: "השהיית הפעלה" }),
  ).toBeVisible();
  await context.close();
});
test("vertical switch entry keeps the selected cell and teacher sees the working", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser, "vertical");
  const result = await student.request.put(
    "http://127.0.0.1:5173/api/preferences",
    {
      headers: { Origin: "http://127.0.0.1:5173" },
      data: {
        mode: "switch",
        dwellMs: 1000,
        dwellSource: "off",
        spotlight: false,
      },
    },
  );
  expect(result.status()).toBe(200);
  await student.reload();
  await expect(
    student.getByRole("button", { name: "התחל עבודה" }),
  ).toBeVisible();
  await scanTo(student, "התחל עבודה ←");
  await scanTo(student, "המרה או שארית בעמודה 3");
  await scanTo(student, "ספרות 1 עד 3");
  await student.keyboard.press("Enter");
  await expect(student.getByLabel("המרה או שארית בעמודה 3")).toHaveValue("1");
  await expect(student.getByLabel("תשובה בעמודה 1")).toHaveValue("");
  await scanTo(student, "תשובה בעמודה 2");
  await scanTo(student, "ספרות 4 עד 6");
  await student.keyboard.press("Space");
  await student.keyboard.press("Enter");
  await expect(student.getByLabel("תשובה בעמודה 2")).toHaveValue("5");
  await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await scanTo(student, "הגשה למורה");
  await page.goto("/");
  await page.getByRole("button", { name: "בדיקת העבודה" }).click();
  await expect(page.getByLabel("המרה או שארית בעמודה 3")).toHaveText("1");
  await expect(page.getByLabel("תשובה בעמודה 2")).toHaveText("5");
  await context.close();
});

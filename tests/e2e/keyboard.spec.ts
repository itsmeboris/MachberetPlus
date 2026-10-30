import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";

test("touch remains usable while app dwell is enabled", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  const origin = new URL(student.url()).origin;
  const response = await student.request.put("/api/preferences", {
    headers: { Origin: origin },
    data: { mode: "gaze", dwellMs: 800, dwellSource: "app", spotlight: false },
  });
  expect(response.ok()).toBe(true);
  const touchContext = await browser.newContext({
    storageState: await context.storageState(),
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const touch = await touchContext.newPage();
  await touch.goto(origin);
  await expect(
    touch.getByRole("button", { name: "השהיית הפעלה" }),
  ).toBeVisible();
  await touch.getByRole("button", { name: "התחל עבודה" }).tap();
  await expect(touch.getByLabel("התשובה שלי", { exact: true })).toBeVisible();
  if (!(await touch.locator(".keyboard-groups").isVisible())) {
    await touch.getByRole("button", { name: "פתיחת מקלדת" }).tap();
  }
  await touch
    .locator(".keyboard-groups")
    .getByRole("button", { name: "1", exact: true })
    .tap();
  await expect(touch.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "1",
  );
  await touchContext.close();
  await context.close();
});

test("mobile keypad stays compact, enters decimals and explains mathematical symbols", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  await student.getByRole("button", { name: "התחל עבודה" }).click();
  if (!(await student.locator(".keyboard-groups").isVisible())) {
    await student.getByRole("button", { name: "פתיחת מקלדת" }).click();
  }
  const keypad = student.locator(".keyboard-groups");
  for (const width of [320, 390]) {
    await student.setViewportSize({ width, height: 844 });
    const row = keypad.locator(".keyboard-row").first();
    const boxes = await row.getByRole("button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const { top, width, height } = button.getBoundingClientRect();
        return { top, width, height };
      }),
    );
    expect(boxes).toHaveLength(3);
    expect(new Set(boxes.map((box) => box.top)).size).toBe(1);
    expect(boxes.every((box) => box.width >= 48 && box.height >= 48)).toBe(
      true,
    );
    expect((await keypad.boundingBox())!.height).toBeLessThan(300);
    expect(
      await student.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await keypad.getByRole("button", { name: "1", exact: true }).click();
  await keypad.getByRole("button", { name: "נקודה עשרונית" }).click();
  await keypad.getByRole("button", { name: "5", exact: true }).click();
  await expect(student.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "1.5",
  );
  await keypad.getByRole("button", { name: "סימנים ופעולות" }).click();
  for (const label of ["כפל", "חילוק", "קו שבר", "משתנה x"]) {
    await keypad.getByRole("button", { name: label, exact: true }).click();
  }
  await expect(student.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "1.5×÷/x",
  );
  await keypad.getByRole("button", { name: "הסתרת סימנים" }).click();
  await student.screenshot({
    path: "artifacts/student-mobile-keypad.png",
    fullPage: true,
  });
  await context.close();
});

test("access modes immediately resize keys and explain gaze and dwell independently", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  await student.getByRole("button", { name: "התחל עבודה" }).click();
  if (!(await student.locator(".keyboard-groups").isVisible())) {
    await student.getByRole("button", { name: "פתיחת מקלדת" }).click();
  }
  await student.getByRole("button", { name: "התאמות אישיות" }).click();
  await student.getByLabel("מיקוד בשאלה הפעילה", { exact: true }).uncheck();
  await expect(student.locator(".question")).not.toHaveClass(/spotlight/);
  await student.getByLabel("מיקוד בשאלה הפעילה", { exact: true }).check();
  await expect(student.locator(".question")).toHaveClass(/spotlight/);
  await student.getByLabel("מיקוד בשאלה הפעילה", { exact: true }).uncheck();
  const mode = student.getByLabel("דרך ההפעלה", { exact: true });
  for (const value of ["motor", "gaze"]) {
    await mode.selectOption(value);
    const bounds = await student
      .locator(".keyboard-groups")
      .getByRole("button", { name: "1", exact: true })
      .boundingBox();
    expect(bounds!.width).toBeGreaterThanOrEqual(88);
    expect(bounds!.height).toBeGreaterThanOrEqual(88);
  }
  await expect(
    student.getByText("המחברת אינה מפעילה מצלמה", { exact: false }),
  ).toBeVisible();
  await expect(student.getByLabel("הפעלה בשהייה", { exact: true })).toHaveValue(
    "off",
  );
  await expect(student.getByRole("slider")).toHaveCount(0);
  await mode.selectOption("standard");
  expect(
    (await student
      .locator(".keyboard-groups")
      .getByRole("button", { name: "1", exact: true })
      .boundingBox())!.height,
  ).toBeLessThan(88);
  await student.getByRole("button", { name: "שמירת ההתאמות" }).click();
  await expect(
    student.getByRole("heading", { name: "איך נוח לי ללמוד?" }),
  ).toHaveCount(0);
  await context.close();
});

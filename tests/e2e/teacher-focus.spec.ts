import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { studentFixture } from "./helpers";

test("teacher focus preserves typing, reports receipt, and allows either person to end it", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const { student, context, assignment, post } = await studentFixture(
    page,
    browser,
  );
  const room = await post("/classrooms", { name: "כיתת מיקוד" });
  await post(`/classrooms/${room.id}/students`, {
    studentIds: [assignment.studentId],
  });
  try {
    await page.reload();
    await page.getByLabel("ניהול כיתה").selectOption(room.id);
    await student.getByRole("button", { name: "התחל עבודה" }).click();
    const answer = student.getByRole("textbox", { name: "התשובה שלי" });
    await answer.fill("0.5");
    const prefs = await (await student.request.get("/api/preferences")).json();
    await page.getByRole("button", { name: /^הפעלת מיקוד עבור/ }).click();
    await student.bringToFront();
    await answer.focus();
    await expect(student.locator("html")).toHaveAttribute(
      "data-teacher-focus",
      "true",
      { timeout: 12000 },
    );
    await expect(answer).toBeFocused();
    await expect(answer).toHaveValue("0.5");
    await answer.press("End");
    await answer.press("6");
    await expect(answer).toHaveValue("0.56");
    await expect(student.locator(".teacher-focus-mask")).toBeVisible();
    expect(
      await student
        .locator(".question")
        .evaluate((el) => getComputedStyle(el).zIndex),
    ).toBe("21");
    expect(
      await student
        .locator(".teacher-focus-mask")
        .evaluate((el) => getComputedStyle(el).pointerEvents),
    ).toBe("none");
    for (const theme of ["cream", "blue", "slate"]) {
      await student.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      const audit = await new AxeBuilder({ page: student })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(audit.violations, theme).toEqual([]);
    }
    await student.locator(".question").scrollIntoViewIfNeeded();
    await student.screenshot({ path: ".superpowers/teacher-focus-mobile.png" });
    await student.emulateMedia({ forcedColors: "active" });
    await expect(student.locator(".teacher-focus-mask")).toBeHidden();
    await student.emulateMedia({ forcedColors: "none" });
    await page.bringToFront();
    await expect(page.getByText("בקשת המיקוד התקבלה במכשיר")).toBeVisible({
      timeout: 12000,
    });
    await page.getByRole("button", { name: /^סיום מיקוד עבור/ }).click();
    await student.bringToFront();
    await expect(student.locator(".teacher-focus-banner")).toHaveCount(0, {
      timeout: 12000,
    });
    await page.getByRole("button", { name: /^הפעלת מיקוד עבור/ }).click();
    await expect(student.locator(".teacher-focus-banner")).toBeVisible({
      timeout: 12000,
    });
    await student
      .getByRole("button", { name: "סיום המיקוד", exact: true })
      .click();
    await expect(student.locator(".teacher-focus-mask")).toHaveCount(0);
    await page.bringToFront();
    await expect(page.getByText("התלמיד סיים את המיקוד")).toBeVisible({
      timeout: 12000,
    });
    expect(
      await (await student.request.get("/api/preferences")).json(),
    ).toEqual(prefs);
    await expect(answer).toHaveValue("0.56");
    await page.getByRole("button", { name: /^הפעלת מיקוד עבור/ }).click();
    await student.bringToFront();
    await expect(student.locator(".teacher-focus-banner")).toBeVisible({
      timeout: 12000,
    });
    await student
      .getByRole("button", { name: "הגשה למורה", exact: true })
      .click();
    await student.getByRole("button", { name: "העבודות שסיימתי" }).click();
    await student.getByRole("button", { name: "צפייה בעבודה" }).click();
    await expect(student.locator(".work-record")).toBeVisible();
    expect(
      await student
        .getByRole("button", { name: /חזרה למשימות/ })
        .evaluate((el) => {
          let node: Element | null = el;
          while (node) {
            if (getComputedStyle(node).zIndex === "21") return true;
            node = node.parentElement;
          }
          return false;
        }),
    ).toBe(true);
    expect(
      await student
        .getByRole("button", { name: "חזרה לתיקון התשובות" })
        .evaluate((el) => getComputedStyle(el.parentElement!).zIndex),
    ).toBe("21");
  } finally {
    await context.close();
  }
});

test("focus expires without a connection and a dismissed request cannot reappear", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  let id = crypto.randomUUID(),
    seconds = 2;
  await student.route("**/api/focus", (route) =>
    route.fulfill({
      json: {
        active: true,
        requestId: id,
        serverNow: 1000,
        expiresAt: 1000 + seconds * 1000,
        acknowledgedAt: null,
        endedBy: null,
      },
    }),
  );
  try {
    await student.getByRole("button", { name: "התחל עבודה" }).click();
    await student.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(student.locator(".teacher-focus-banner")).toBeVisible();
    await context.setOffline(true);
    await expect(student.locator(".teacher-focus-banner")).toHaveCount(0, {
      timeout: 4000,
    });
    await context.setOffline(false);
    id = crypto.randomUUID();
    seconds = 300;
    await student.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(student.locator(".teacher-focus-banner")).toBeVisible();
    await student.route("**/api/focus/dismiss", (route) => route.abort());
    await student
      .getByRole("button", { name: "סיום המיקוד", exact: true })
      .click();
    await student.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(student.locator(".teacher-focus-banner")).toHaveCount(0);
    await student.waitForTimeout(5500);
    await expect(student.locator(".teacher-focus-banner")).toHaveCount(0);
    await student.reload();
    await expect(
      student.getByRole("button", { name: "התחל עבודה" }),
    ).toBeVisible();
    await student.waitForTimeout(1000);
    await expect(student.locator(".teacher-focus-banner")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

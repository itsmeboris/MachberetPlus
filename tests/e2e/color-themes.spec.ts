import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { studentFixture } from "./helpers";

test("student theme menu saves immediately, preserves other settings and recovers failed saves", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const { student, context } = await studentFixture(page, browser);
  const trigger = student.getByRole("button", { name: /^צבעי המסך:/ });
  const themeNames = { cream: "קרם חמים", blue: "כחול בהיר", slate: "כהה" };
  const audit = async (label: string) => {
    const result = await new AxeBuilder({ page: student })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations, label).toEqual([]);
  };
  try {
    await expect(trigger).toContainText("קרם חמים");
    await student.getByRole("button", { name: "התאמות אישיות" }).click();
    await student.getByLabel("גודל טקסט").selectOption("1.25");
    await student.getByRole("button", { name: "שמירת ההתאמות" }).click();
    await expect(
      student.getByRole("button", { name: "התאמות אישיות" }),
    ).toBeFocused();
    for (const theme of ["cream", "blue", "slate"] as const) {
      await trigger.click();
      await student
        .getByRole("button", { name: new RegExp(`^${themeNames[theme]}`) })
        .click();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(trigger).toBeFocused();
      await expect(student.locator("html")).toHaveAttribute(
        "data-theme",
        theme,
      );
      await student.reload();
      await expect(trigger).toContainText(themeNames[theme]);
      await expect(student.locator("html")).toHaveAttribute(
        "data-theme",
        theme,
      );
      await student
        .getByRole("button", { name: /התחל עבודה|המשך עבודה/ })
        .click();
      if (!(await student.locator(".keyboard-groups").isVisible())) {
        await student.getByRole("button", { name: "פתיחת מקלדת" }).click();
      }
      await audit(`${theme} workbook`);
      await student.screenshot({
        path: `artifacts/theme-${theme}-mobile.png`,
        fullPage: true,
      });
      await trigger.click();
      await expect(
        student.getByRole("button", {
          name: new RegExp(`^${themeNames[theme]}`),
        }),
      ).toHaveAttribute("aria-pressed", "true");
      await audit(`${theme} menu`);
      await student.getByRole("button", { name: "סגירת בחירת הצבעים" }).click();
      await expect(trigger).toBeFocused();
    }
    // A stale initial load cannot replace a newer, successfully saved choice.
    let release!: () => void;
    let captured!: () => void;
    let delivered!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const seen = new Promise<void>((resolve) => {
      captured = resolve;
    });
    const completed = new Promise<void>((resolve) => {
      delivered = resolve;
    });
    await student.route("**/api/preferences", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      captured();
      await held;
      await route.fulfill({ response });
      delivered();
    });
    await student.reload();
    await seen;
    await trigger.click();
    await student.getByRole("button", { name: /^כחול בהיר/ }).click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    release();
    await completed;
    await student.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(student.locator("html")).toHaveAttribute("data-theme", "blue");
    await student.unroute("**/api/preferences");
    await trigger.click();
    await student.getByRole("button", { name: /^כהה/ }).click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    // Failed persistence must not pretend the preview has been saved.
    await student.route("**/api/preferences", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "שמירת הצבעים נכשלה" }),
          })
        : route.continue(),
    );
    await trigger.click();
    await student.getByRole("button", { name: /^כחול בהיר/ }).click();
    await expect(student.getByRole("alert")).toContainText(
      "שמירת הצבעים נכשלה",
    );
    await expect(student.locator("html")).toHaveAttribute(
      "data-theme",
      "slate",
    );
    await audit("slate error state");
    await student.unroute("**/api/preferences");
    await student.setViewportSize({ width: 320, height: 844 });
    expect(
      await student.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await student.screenshot({
      path: "artifacts/theme-menu-mobile.png",
      fullPage: true,
    });
    await student.emulateMedia({ forcedColors: "active" });
    expect(
      await student
        .locator("html")
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--ink").trim(),
        ),
    ).toBe("CanvasText");
    await student.emulateMedia({ forcedColors: "none", media: "print" });
    expect(
      await student
        .locator("html")
        .evaluate((el) =>
          getComputedStyle(el).getPropertyValue("--ink").trim(),
        ),
    ).toBe("black");
    await student.emulateMedia({ media: "screen" });
    await student
      .getByRole("button", { name: "החזרת צבעי ברירת המחדל" })
      .click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await student.reload();
    await expect(student.locator("html")).toHaveAttribute(
      "data-theme",
      "cream",
    );
    const saved = await (await student.request.get("/api/preferences")).json();
    expect(saved.fontScale).toBe(1.25);
    expect(saved.theme).toBe("cream");
    await page.reload();
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-theme",
      "slate",
    );
    await trigger.click();
    await student.getByRole("button", { name: /^כהה/ }).click();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await student.getByRole("button", { name: /^כחול בהיר/ }).focus();
    await student.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await student.getByRole("button", { name: "יציאה", exact: true }).click();
    await expect(student.getByLabel("דואר אלקטרוני")).toBeVisible();
    await expect(student.locator("html")).not.toHaveAttribute(
      "data-theme",
      /.+/,
    );
  } finally {
    await context.close();
  }
});

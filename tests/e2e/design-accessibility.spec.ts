import { test, expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { studentFixture } from "./helpers";

async function audit(page: Page, name: string, info: TestInfo) {
  if (["teacher", "workbook-keypad", "teacher-review"].includes(name)) {
    await page.screenshot({
      path: `artifacts/accessible-${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await info.attach(`${name}-screen`, {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  await info.attach(name, {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  const failures = results.violations.map(({ id, nodes }) => ({
    id,
    nodes: nodes.map(({ target, failureSummary }) => ({
      target,
      failureSummary,
    })),
  }));
  expect.soft(failures, name).toEqual([]);
}

async function reflow(page: Page) {
  await page.setViewportSize({ width: 320, height: 844 });
  const checkWidth = async () => {
    const layout = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll<HTMLElement>("body *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
        })
        .map(
          (el) =>
            `${el.tagName}.${el.className}: ${el.textContent?.slice(0, 50)}`,
        )
        .slice(-12),
    }));
    expect(layout.width, JSON.stringify(layout.overflow)).toBeLessThanOrEqual(
      321,
    );
  };
  await checkWidth();
  // Snapshot first so inherited sizes are not multiplied more than once.
  // This exercises fixed-pixel text too, unlike changing only the root size.
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll<HTMLElement>("body *")].map(
      (element) => ({
        element,
        size: parseFloat(getComputedStyle(element).fontSize),
      }),
    );
    sizes.forEach(({ element, size }) =>
      element.style.setProperty("font-size", `${size * 2}px`, "important"),
    );
  });
  await checkWidth();
}

test("Hebrew authentication has accessible labels, contrast and narrow text reflow", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByLabel("דואר אלקטרוני")).toBeVisible();
  await audit(page, "authentication", info);
  await page.getByRole("button", { name: "יצירת חשבון מורה" }).click();
  await audit(page, "registration", info);
  await reflow(page);
});

test("teacher, capture, workbook, review and parent keep accessible contrast and semantics", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000);
  const { student, context } = await studentFixture(page, browser);
  try {
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "סביבת המורה" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "משימה חדשה" })).toBeEnabled();
    await audit(page, "teacher", info);
    await page.getByText(/קישורי כניסה וניהול תלמידים/).click();
    await page.getByRole("button", { name: "בקשת צילום מהורה" }).click();
    const captureLink = await page.getByLabel("קישור לצילום בבית").inputValue();
    const parentCapture = await context.newPage();
    await parentCapture.goto(captureLink);
    await expect(
      parentCapture.getByRole("button", { name: "שליחת הדף למורה" }),
    ).toBeVisible();
    await audit(parentCapture, "parent-capture", info);
    await parentCapture
      .locator("input[type=file]")
      .first()
      .setInputFiles("tests/fixtures/hebrew-worksheet.png");
    await expect(parentCapture.getByAltText("דף המקור")).toBeVisible();
    await audit(parentCapture, "parent-image-editor", info);
    await reflow(parentCapture);
    await reflow(page);
    await page.reload();
    await page.getByRole("button", { name: "משימה חדשה" }).click();
    await expect(page.getByLabel("שם המשימה")).toBeVisible();
    await audit(page, "capture", info);
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles("tests/fixtures/hebrew-worksheet.png");
    await expect(page.getByAltText("דף המקור")).toBeVisible();
    await audit(page, "teacher-image-editor", info);
    await reflow(page);
    await audit(student, "student-home", info);
    await student.getByRole("button", { name: "התחל עבודה" }).click();
    await expect(
      student.getByLabel("התשובה שלי", { exact: true }),
    ).toBeVisible();
    if (!(await student.locator(".keyboard-groups").isVisible())) {
      await student.getByRole("button", { name: "פתיחת מקלדת" }).click();
    }
    await audit(student, "workbook-keypad", info);
    await student.getByRole("button", { name: "התאמות אישיות" }).click();
    await audit(student, "access-preferences", info);
    await student.getByRole("button", { name: "שמירת ההתאמות" }).click();
    await student.getByLabel("התשובה שלי", { exact: true }).fill("15");
    await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
    await student.getByRole("button", { name: "הגשה למורה" }).click();
    await page.goto("/");
    await page.getByRole("button", { name: "בדיקת העבודה" }).click();
    await audit(page, "teacher-review", info);
    await reflow(page);
    await page.getByRole("button", { name: "סיום הבדיקה" }).click();
    await page.getByRole("button", { name: "יצירת קישור להורה" }).click();
    const link = await page.getByLabel("קישור להורה").inputValue();
    const parent = await context.newPage();
    await parent.goto(link);
    await expect(
      parent.getByRole("button", { name: "עברנו יחד על הדף" }),
    ).toBeVisible();
    await audit(parent, "parent-review", info);
    await reflow(parent);
  } finally {
    await context.close();
  }
});

test("student controls reflow with enlarged text and retain focus and state in OS display modes", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  try {
    await student.emulateMedia({
      reducedMotion: "reduce",
      forcedColors: "active",
    });
    const selected = student.getByRole("button", { pressed: true });
    await expect(selected).toHaveCount(1);
    expect(
      await selected.evaluate((el) => getComputedStyle(el).borderStyle),
    ).not.toBe("none");
    await student.getByRole("button", { name: "התחל עבודה" }).click();
    if (!(await student.locator(".keyboard-groups").isVisible())) {
      await student.getByRole("button", { name: "פתיחת מקלדת" }).click();
    }
    await reflow(student);
    // Walk the real tab order; the browser must scroll every control into view.
    await student.getByRole("link", { name: "מחברת פלוס" }).focus();
    for (let i = 0; i < 18; i++) {
      await student.keyboard.press("Tab");
      const focus = await student.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const r = el.getBoundingClientRect();
        const x = Math.max(0, Math.min(innerWidth - 1, r.x + r.width / 2));
        const y = Math.max(0, Math.min(innerHeight - 1, r.y + r.height / 2));
        const hit = document.elementFromPoint(x, y);
        const style = getComputedStyle(el);
        return {
          visible:
            r.bottom > 0 &&
            r.top < innerHeight &&
            !!hit &&
            (el === hit || el.contains(hit)),
          outline: parseFloat(style.outlineWidth),
          transition: style.transitionDuration,
        };
      });
      expect(focus.visible).toBe(true);
      expect(focus.outline).toBeGreaterThanOrEqual(2);
      expect(
        focus.transition.split(",").every((value) => parseFloat(value) <= 0.01),
      ).toBe(true);
    }
  } finally {
    await context.close();
  }
});

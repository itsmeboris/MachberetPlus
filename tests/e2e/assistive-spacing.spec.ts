import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";

test("assistive keys keep 88px targets, 20px separation and primary edge clearance without phone overflow", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  try {
    await student.getByRole("button", { name: "התחל עבודה" }).click();
    if (!(await student.locator(".keyboard-groups").isVisible())) {
      await student.getByRole("button", { name: "פתיחת מקלדת" }).click();
    }
    await student.getByRole("button", { name: "התאמות אישיות" }).click();
    for (const mode of ["motor", "gaze", "switch"]) {
      await student
        .getByLabel("דרך ההפעלה", { exact: true })
        .selectOption(mode);
      for (const width of [320, 390, 768]) {
        await student.setViewportSize({ width, height: 900 });
        const rows = student.locator(".keyboard-row");
        const geometry = await rows.first().evaluate((el) => ({
          gap: parseFloat(getComputedStyle(el).gap),
          keys: [...el.querySelectorAll("button")].map((button) => ({
            width: button.getBoundingClientRect().width,
            height: button.getBoundingClientRect().height,
          })),
        }));
        expect(geometry.gap).toBeGreaterThanOrEqual(20);
        expect(
          geometry.keys.every((key) => key.width >= 88 && key.height >= 88),
        ).toBe(true);
        expect(
          await student.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        const submit = await student
          .getByRole("button", { name: "הגשה למורה" })
          .boundingBox();
        expect(submit!.x).toBeGreaterThanOrEqual(48);
        expect(width - submit!.x - submit!.width).toBeGreaterThanOrEqual(48);
      }
    }
    await student
      .getByLabel("דרך ההפעלה", { exact: true })
      .selectOption("standard");
    const key = student
      .locator(".keyboard-groups")
      .getByRole("button", { name: "1", exact: true });
    const tabletKey = await key.boundingBox();
    expect(tabletKey!.height).toBeGreaterThanOrEqual(64);
    await student.setViewportSize({ width: 390, height: 844 });
    expect(
      (await student.locator(".keyboard-groups").boundingBox())!.height,
    ).toBeLessThan(300);
  } finally {
    await context.close();
  }
});

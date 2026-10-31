import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";

test("image corners support drag and keyboard; cancel restores source and apply keeps correction", async ({
  page,
  browser,
}) => {
  const { context } = await studentFixture(page, browser);
  await page.goto("/");
  await page.getByRole("button", { name: "משימה חדשה" }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("tests/fixtures/hebrew-worksheet.png");
  const photo = page.getByAltText("דף המקור");
  await expect(photo).toBeVisible();
  const source = await photo.getAttribute("src");
  await page.getByRole("button", { name: "חיתוך וסיבוב התמונה" }).click();
  const corner = page.getByRole("button", {
    name: "פינה 1 — שמאלית עליונה",
    exact: true,
  });
  await corner.focus();
  await page.keyboard.press("ArrowRight");
  await expect(corner).toHaveCSS("left", /.+/);
  expect(await corner.evaluate((el) => el.style.left)).toBe("1%");
  const box = (await photo.boundingBox())!;
  const handle = (await corner.boundingBox())!;
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.15, {
    steps: 5,
  });
  await page.mouse.up();
  expect(
    parseFloat(await corner.evaluate((el) => el.style.left)),
  ).toBeGreaterThan(10);
  await page.getByRole("button", { name: "סיבוב ימינה" }).click();
  await expect(photo).not.toHaveAttribute("src", source!);
  await page.getByRole("button", { name: "ביטול", exact: true }).click();
  await expect(photo).toHaveAttribute("src", source!);
  await expect(corner).toHaveCount(0);
  await page.getByRole("button", { name: "חיתוך וסיבוב התמונה" }).click();
  expect(await corner.evaluate((el) => el.style.left)).toBe("0%");
  await corner.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await page.getByRole("button", { name: "שמירת התמונה", exact: true }).click();
  await expect(corner).toHaveCount(0);
  await expect(photo).not.toHaveAttribute("src", source!);
  await context.close();
});

test("image corners can be adjusted using only selection and pointer clicks", async ({
  page,
  browser,
}) => {
  const { context } = await studentFixture(page, browser);
  await page.goto("/");
  await page.getByRole("button", { name: "משימה חדשה" }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("tests/fixtures/hebrew-worksheet.png");
  await page.getByRole("button", { name: "חיתוך וסיבוב התמונה" }).click();
  const first = page.getByRole("button", {
    name: "פינה 1 — שמאלית עליונה",
    exact: true,
  });
  const second = page.getByRole("button", {
    name: "פינה 2 — ימנית עליונה",
    exact: true,
  });
  await page.getByLabel("בחירת פינה להזזה").selectOption("1");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "הזזה שמאלה", exact: true }).click();
  await page.getByRole("button", { name: "הזזה למטה", exact: true }).click();
  expect(await second.evaluate((el) => [el.style.left, el.style.top])).toEqual([
    "99%",
    "1%",
  ]);
  expect(await first.evaluate((el) => [el.style.left, el.style.top])).toEqual([
    "0%",
    "0%",
  ]);
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "הזזה ימינה", exact: true }).click();
  await page.getByRole("button", { name: "הזזה למטה", exact: true }).click();
  await page.getByRole("button", { name: "הזזה למעלה", exact: true }).click();
  expect(await first.evaluate((el) => [el.style.left, el.style.top])).toEqual([
    "1%",
    "0%",
  ]);
  await page.getByRole("button", { name: "שמירת התמונה", exact: true }).click();
  await expect(first).toHaveCount(0);
  await context.close();
});

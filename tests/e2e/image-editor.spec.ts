import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";

test("image corners support drag and keyboard; cancel restores source and apply keeps correction", async ({
  page,
  browser,
}) => {
  const { context } = await studentFixture(page, browser);
  await page.goto("/");
  await page.getByRole("button", { name: "משימה חדשה", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("tests/fixtures/hebrew-worksheet.png");
  const photo = page.getByAltText("דף המקור");
  await expect(photo).toBeVisible();
  const source = await photo.getAttribute("src");
  await page.getByRole("button", { name: "חיתוך וסיבוב התמונה" }).click();
  const corner = page.getByRole("button", {
    name: "פינה שמאלית עליונה",
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

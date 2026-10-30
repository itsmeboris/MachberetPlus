import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";
import { join } from "node:path";

test("both supplied handwritten photos produce complete equations through the deployed app", async ({
  page,
}) => {
  test.skip(
    !process.env.PILOT_PHOTO_DIR,
    "Private photos are supplied locally, never committed.",
  );
  const directory = process.env.PILOT_PHOTO_DIR!;
  const files = readdirSync(directory)
    .filter((n) =>
      /^WhatsApp Image 2026-10-30 at 23\.37\.(10|16)\.jpeg$/.test(n),
    )
    .sort();
  expect(files).toHaveLength(2);
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  const account = await page.request.post(origin + "/api/auth/register", {
    headers: { Origin: origin },
    data: {
      name: "בדיקת צילום",
      email: `photo-${Date.now()}@example.test`,
      password: "photo-test-password-2026",
      consent: true,
    },
  });
  expect(account.ok()).toBeTruthy();
  try {
    await page.request.post(origin + "/api/students", {
      headers: { Origin: origin },
      data: { name: "תלמיד בדיקה", consent: true },
    });
    await page.reload();
    await page.getByRole("button", { name: "משימה חדשה" }).click();
    await expect(
      page.getByLabel("אופן הזיהוי").locator("option[value=cloud]"),
    ).toHaveCount(1);
    await page.getByLabel("אופן הזיהוי").selectOption("cloud");
    await page.getByLabel("אני מאשר/ת לשלוח את התמונה").check();
    for (const file of files) {
      await page
        .locator("input[type=file]")
        .first()
        .setInputFiles(join(directory, file));
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/recognition") &&
          r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "זיהוי תרגילים מהדף" }).click();
      expect((await response).ok()).toBeTruthy();
      await expect(page.getByRole("status")).toContainText("הזיהוי הושלם");
      const math = await page
        .getByLabel("ביטוי מתמטי")
        .evaluateAll((inputs) =>
          inputs.map((el) => (el as HTMLInputElement).value.replace(/\s/g, "")),
        );
      expect(math).toEqual(["x+5=12", "2x+7=8", "3x-6=4"]);
      console.log("Handwritten photograph verified:", file);
    }
  } finally {
    const deleted = await page.request.delete(origin + "/api/account", {
      headers: { Origin: origin },
      data: {},
    });
    expect(deleted.ok()).toBeTruthy();
  }
});

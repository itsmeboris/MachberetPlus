import { test, expect } from "@playwright/test";
import { join } from "node:path";

test("free local model reads both private handwriting photos without uploading them", async ({
  page,
}) => {
  test.skip(
    !process.env.PILOT_PHOTO_DIR,
    "Opt-in private photographs stay outside Git.",
  );
  test.setTimeout(300_000);
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  const registered = await page.request.post(`${origin}/api/auth/register`, {
    headers: { Origin: origin },
    data: {
      name: "בדיקת זיהוי מקומי",
      email: `free-ocr-${Date.now()}@example.test`,
      password: "free-ocr-test-password-2026",
      consent: true,
    },
  });
  expect(registered.ok()).toBeTruthy();
  try {
    const student = await page.request.post(`${origin}/api/students`, {
      headers: { Origin: origin },
      data: { name: "תלמיד בדיקה", consent: true },
    });
    expect(student.ok()).toBeTruthy();
    await page.reload();
    await page.getByRole("button", { name: "משימה חדשה" }).click();
    await expect(page.getByLabel("אופן הזיהוי")).toHaveValue("handwriting");
    const writes: string[] = [];
    page.context().on("request", (request) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method()))
        writes.push(request.url());
    });
    for (const suffix of ["16", "10"]) {
      await page
        .locator("input[type=file]")
        .first()
        .setInputFiles(
          join(
            process.env.PILOT_PHOTO_DIR!,
            `WhatsApp Image 2026-10-30 at 23.37.${suffix}.jpeg`,
          ),
        );
      const started = Date.now();
      await page.getByRole("button", { name: "זיהוי תרגילים מהדף" }).click();
      await expect(page.getByRole("status")).toContainText(
        "הזיהוי הושלם במכשיר",
        { timeout: 180_000 },
      );
      const values = await page
        .getByLabel("ביטוי מתמטי")
        .evaluateAll((inputs) =>
          inputs.map((el) => (el as HTMLInputElement).value.replace(/\s/g, "")),
        );
      console.log(
        "Local handwriting",
        suffix,
        `${Date.now() - started}ms`,
        JSON.stringify(values),
      );
      expect(values).toEqual(["x+5=12", "2x+7=8", "3x-6=4"]);
      expect(writes).toEqual([]);
      // The second photo must work with all model-host requests blocked: cache reuse.
      await page
        .context()
        .route("https://huggingface.co/**", (route) => route.abort());
    }
  } finally {
    const deleted = await page.request.delete(`${origin}/api/account`, {
      headers: { Origin: origin },
      data: {},
    });
    expect(deleted.ok()).toBeTruthy();
  }
});

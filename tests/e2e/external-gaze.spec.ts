import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";

// Exercises the browser input contract, not OptiKey's Windows injection or hardware.
for (const kind of ["equation", "text"]) {
  test(`external gaze software can click, type, correct and resume ${kind} answers without app dwell`, async ({
    page,
    browser,
  }) => {
    const { context, student } = await studentFixture(page, browser, kind);
    try {
      const origin = new URL(student.url()).origin;
      const saved = await student.request.put(`${origin}/api/preferences`, {
        headers: { Origin: origin },
        data: { mode: "gaze", dwellSource: "device", dwellMs: 800 },
      });
      expect(saved.ok()).toBe(true);
      // Reduced browser work area models space occupied by a docked external keyboard.
      await student.setViewportSize({ width: 1280, height: 600 });
      await student.reload();
      const start = student.getByRole("button", { name: "התחל עבודה" });
      await start.hover();
      // Deliberately exceed the maximum app dwell period to detect unwanted activation.
      await student.waitForTimeout(1600);
      await expect(
        student.getByLabel("התשובה שלי", { exact: true }),
      ).toHaveCount(0);
      await start.click();
      const answer = student.getByLabel("התשובה שלי", { exact: true });
      await answer.click();
      if (kind === "equation") {
        await student.keyboard.type("0.5");
      } else {
        await student.keyboard.insertText("שָׁלוֹם");
        await student.keyboard.press("Space");
        await student.keyboard.insertText("עולם");
      }
      const original = kind === "equation" ? "0.5" : "שָׁלוֹם עולם";
      await expect(answer).toHaveValue(original);
      await student.keyboard.press("Control+A");
      await student.keyboard.press("Backspace");
      const corrected = kind === "equation" ? "x = -1/2" : "שָׁלוֹם לכולם";
      await student.keyboard.insertText(corrected);
      await expect(answer).toHaveValue(corrected);
      if (!(await student.locator(".keyboard-groups").isVisible())) {
        await student.getByRole("button", { name: "פתיחת מקלדת" }).click();
      }
      const key = student
        .locator(".keyboard-groups")
        .getByRole("button", {
          name: kind === "equation" ? "1" : "א",
          exact: true,
        });
      await key.hover();
      await student.waitForTimeout(1600);
      await expect(answer).toHaveValue(corrected);
      await key.click();
      const expected = corrected + (kind === "equation" ? "1" : "א");
      await expect(answer).toHaveValue(expected);
      await student.waitForTimeout(1600);
      await expect(answer).toHaveValue(expected);
      await expect(student.locator(".dwell-target")).toHaveCount(0);
      await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
      await student.reload();
      await student.getByRole("button", { name: "המשך עבודה" }).click();
      await expect(answer).toHaveValue(expected);
      await answer.click();
      await expect(answer).toBeInViewport();
      await expect(answer).toBeFocused();
    } finally {
      await context.close();
    }
  });
}

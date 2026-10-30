import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";
test("a network failure keeps the answer and retry saves it", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  await student.getByRole("button", { name: "התחל עבודה" }).click();
  await student.route("**/api/assignments/*/answers", (route) => route.abort());
  await student.getByLabel("התשובה שלי", { exact: true }).fill("15");
  await expect(student.getByRole("status")).toContainText("אין חיבור");
  await student.unroute("**/api/assignments/*/answers");
  await student.getByRole("button", { name: "ניסיון שמירה נוסף" }).click();
  await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await student.reload();
  await student.getByRole("button", { name: "המשך עבודה" }).click();
  await expect(student.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "15",
  );
  await context.close();
});
test("a conflicting local draft survives reload and requires an explicit resolution", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  const second = await context.newPage();
  await second.goto("http://127.0.0.1:5173/");
  await student.getByRole("button", { name: "התחל עבודה" }).click();
  await second.getByRole("button", { name: "התחל עבודה" }).click();
  await student.getByLabel("התשובה שלי", { exact: true }).fill("15");
  await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await second.getByLabel("התשובה שלי", { exact: true }).fill("20");
  await expect(second.getByRole("status")).toContainText("גרסה אחרת");
  await second.reload();
  await second.getByRole("button", { name: "המשך עבודה" }).click();
  await expect(second.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "20",
  );
  await second.getByRole("button", { name: "שמירת התשובות מהמכשיר" }).click();
  await expect(second.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await second.reload();
  await second.getByRole("button", { name: "המשך עבודה" }).click();
  await expect(second.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "20",
  );
  await context.close();
});

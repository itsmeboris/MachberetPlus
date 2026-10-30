import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";
test("returned work exposes teacher corrections beside the editable answer", async ({
  page,
  browser,
}) => {
  const { student, context } = await studentFixture(page, browser);
  await student.getByRole("button", { name: "התחל עבודה" }).click();
  await student.getByLabel("התשובה שלי", { exact: true }).fill("12");
  await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await student.getByRole("button", { name: "הגשה למורה" }).click();
  await expect(student.getByText("המחברת מחכה למשימה חדשה")).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "בדיקת העבודה" }).click();
  await expect(
    page.getByText("התלמיד יוכל לשנות תשובות ולהגיש שוב.", { exact: false }),
  ).toBeVisible();
  await page
    .getByText("הוספת הערה לתרגיל 1 (לא חובה)", { exact: true })
    .click();
  await page.getByLabel("הערה כתובה").fill("נסו לחבר עוד שלוש");
  await page.getByRole("button", { name: "החזרה לתיקון", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "הורדת העבודה והמשוב" }),
  ).toBeVisible();
  await student.reload();
  await student.getByRole("button", { name: "המשך עבודה" }).click();
  await expect(
    student.getByText("נסו לחבר עוד שלוש", { exact: true }),
  ).toBeVisible();
  await expect(student.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "12",
  );
  await context.close();
});

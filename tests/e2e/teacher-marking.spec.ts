import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";

test("teacher can mark, clear, and persist an answer mark for student and parent", async ({
  page,
  browser,
}) => {
  const { student, context, assignment } = await studentFixture(page, browser);
  await student.getByRole("button", { name: "התחל עבודה" }).click();
  await student.getByLabel("התשובה שלי", { exact: true }).fill("15");
  await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await student.getByRole("button", { name: "הגשה למורה" }).click();
  await page.goto("/");
  await page.getByRole("button", { name: "בדיקת העבודה" }).click();
  const marks = page.getByRole("group", { name: "סימון התשובה לתרגיל 1" });
  await expect(marks.getByRole("radio", { name: "לא סומן" })).toBeChecked();
  await marks.getByRole("radio", { name: "כדאי לנסות שוב" }).check();
  await marks.getByRole("radio", { name: "לא סומן" }).check();
  await marks.getByRole("radio", { name: "תשובה נכונה" }).check();
  await page.getByRole("button", { name: "סיום הבדיקה", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "שיתוף העבודה עם ההורה" }),
  ).toBeVisible();
  await expect(page.getByText("תשובה נכונה", { exact: true })).toBeVisible();
  const saved = await (
    await page.request.get(`/api/assignments/${assignment.id}`)
  ).json();
  expect(saved.feedback.q.decision).toBe("reviewed");
  await student.reload();
  await student.getByRole("button", { name: "העבודות שסיימתי" }).click();
  await student.getByRole("button", { name: "צפייה בעבודה" }).click();
  await expect(student.getByText("תשובה נכונה", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "יצירת קישור להורה" }).click();
  const link = await page.getByLabel("קישור להורה").inputValue();
  const parentContext = await browser.newContext();
  const parent = await parentContext.newPage();
  await parent.goto(link);
  await expect(parent.getByText("תשובה נכונה", { exact: true })).toBeVisible();
  const downloadPromise = parent.waitForEvent("download");
  await parent.getByRole("button", { name: "הורדת העבודה והמשוב" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString("utf8")).toContain("תשובה נכונה");
  await page.getByRole("button", { name: "החזרה לתיקון", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "יצירת קישור להורה" }),
  ).toHaveCount(0);
  await parent.reload();
  await expect(parent.getByRole("alert")).toContainText(
    "הקישור פג או אינו זמין",
  );
  await expect(parent.getByText("תשובה נכונה", { exact: true })).toHaveCount(0);
  await student.reload();
  await student.getByRole("button", { name: "המשך עבודה" }).click();
  const answer = student.getByLabel("התשובה שלי", { exact: true });
  await expect(answer).toHaveValue("15");
  await expect(answer).toBeEditable();
  await expect(student.getByText("תשובה נכונה", { exact: true })).toBeVisible();
  await answer.fill("16");
  await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await context.close();
  await parentContext.close();
});

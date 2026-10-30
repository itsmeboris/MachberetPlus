import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";

test("student can reopen submitted answers, correct and resubmit without stale autosave", async ({
  page,
  browser,
}) => {
  const { student, context, assignment } = await studentFixture(page, browser);
  await student.getByRole("button", { name: "התחל עבודה" }).click();
  await student.getByLabel("התשובה שלי", { exact: true }).fill("12");
  await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await student.getByRole("button", { name: "הגשה למורה" }).click();
  await student.getByRole("button", { name: "העבודות שסיימתי" }).click();
  // A leftover device draft must never write into the submitted record on reconnect.
  await student.evaluate(
    ({ id, studentId }) => {
      localStorage.setItem(
        `machberet:${studentId}:${id}`,
        JSON.stringify({
          revision: 0,
          answers: { q: { text: "stale device draft" } },
        }),
      );
    },
    { id: assignment.id, studentId: assignment.studentId },
  );
  await student.getByRole("button", { name: "צפייה בעבודה" }).click();
  let writes = 0;
  student.on("request", (request) => {
    if (request.url().endsWith("/answers") && request.method() === "PUT")
      writes++;
  });
  await student.evaluate(() => window.dispatchEvent(new Event("online")));
  await student.getByRole("button", { name: "חזרה לתיקון התשובות" }).click();
  expect(writes).toBe(0);
  await expect(student.getByLabel("התשובה שלי", { exact: true })).toHaveValue(
    "12",
  );
  await student.getByLabel("התשובה שלי", { exact: true }).fill("15");
  await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await student.getByRole("button", { name: "הגשה למורה" }).click();
  await student.getByRole("button", { name: "צפייה בעבודה" }).click();
  await expect(student.getByText("15", { exact: true })).toBeVisible();
  const saved = await (
    await page.request.get(`/api/assignments/${assignment.id}`)
  ).json();
  expect(saved.status).toBe("submitted");
  expect(saved.answers.q.text).toBe("15");
  await context.close();
});

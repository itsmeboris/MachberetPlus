import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";
test("returned work exposes teacher corrections beside the editable answer", async ({
  page,
  browser,
}) => {
  const { student, context, assignment, post } = await studentFixture(
    page,
    browser,
  );
  await student.getByRole("button", { name: "התחל עבודה" }).click();
  await student.getByLabel("התשובה שלי", { exact: true }).fill("12");
  await expect(student.getByRole("status")).toHaveText("כל השינויים נשמרו");
  await student.getByRole("button", { name: "הגשה למורה" }).click();
  await expect(student.getByText("המחברת מחכה למשימה חדשה")).toBeVisible();
  const review = await page.request.put(
    `http://127.0.0.1:5173/api/assignments/${assignment.id}/review`,
    {
      headers: { Origin: "http://127.0.0.1:5173" },
      data: {
        contentRevision: 1,
        feedback: { q: { text: "נסו לחבר עוד שלוש" } },
      },
    },
  );
  expect(review.status()).toBe(200);
  await post(`/assignments/${assignment.id}/transition`, {
    action: "return",
    contentRevision: 2,
  });
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

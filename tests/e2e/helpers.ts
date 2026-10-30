import { expect, type Browser, type Page } from "@playwright/test";
export async function studentFixture(
  page: Page,
  browser: Browser,
  kind = "arithmetic",
) {
  // Separate synthetic clients; production rate limiting stays unchanged.
  const testClientIP = `192.0.2.${Math.floor(Math.random() * 250) + 1}`;
  const post = async (path: string, data: unknown) => {
    const r = await page.request.post(`http://127.0.0.1:5173/api${path}`, {
      headers: {
        Origin: "http://127.0.0.1:5173",
        "CF-Connecting-IP": testClientIP,
      },
      data,
    });
    if (!r.ok()) throw new Error(await r.text());
    return r.json();
  };
  await post("/auth/register", {
    email: `access-${crypto.randomUUID()}@example.test`,
    password: "pilot-test-password-2026",
    name: "בדיקת גישה",
    consent: true,
  });
  const user = await post("/students", { name: "תלמיד", consent: true });
  const assignment = await post("/assignments", {
    studentId: user.id,
    title: "בדיקת שמירה",
    exercises: [
      { id: "q", kind, prompt: "פתרו", math: "12 + 3", spokenText: "" },
    ],
  });
  const confirmation = await page.request.patch(
    `http://127.0.0.1:5173/api/assignments/${assignment.id}`,
    {
      headers: { Origin: "http://127.0.0.1:5173" },
      data: { confirmed: true, contentRevision: 0 },
    },
  );
  expect(confirmation.status()).toBe(200);
  await post(`/assignments/${assignment.id}/transition`, {
    action: "assign",
    contentRevision: 1,
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const student = await context.newPage();
  student.on("pageerror", (error) =>
    console.error("Student page error:", error.message),
  );
  await student.goto(`http://127.0.0.1:5173/?join=${user.code}`);
  await student.getByRole("button", { name: "כניסה למשימות שלי" }).click();
  await expect(
    student.getByRole("button", { name: "התחל עבודה" }),
  ).toBeVisible();
  return { context, student, assignment, post };
}

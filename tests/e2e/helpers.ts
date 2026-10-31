import { expect, type Browser, type Page } from "@playwright/test";
export async function studentFixture(
  page: Page,
  browser: Browser,
  kind = "arithmetic",
) {
  await page.goto("/");
  const origin = new URL(page.url()).origin;
  // Separate synthetic clients; production rate limiting stays unchanged.
  const testClientIP = `192.0.2.${Math.floor(Math.random() * 250) + 1}`;
  const post = async (path: string, data: unknown) => {
    const r = await page.request.post(`${origin}/api${path}`, {
      headers: {
        Origin: origin,
        ...(new URL(origin).hostname === "127.0.0.1"
          ? { "CF-Connecting-IP": testClientIP }
          : {}),
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
    `${origin}/api/assignments/${assignment.id}`,
    {
      headers: { Origin: origin },
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
    ...(new URL(origin).hostname === "127.0.0.1"
      ? { extraHTTPHeaders: { "CF-Connecting-IP": testClientIP } }
      : {}),
  });
  const student = await context.newPage();
  student.on("pageerror", (error) =>
    console.error("Student page error:", error.message),
  );
  await student.goto(`${origin}/?join=${user.code}`);
  await student.getByRole("button", { name: "כניסה למשימות שלי" }).click();
  await expect(
    student.getByRole("button", { name: "התחל עבודה" }),
  ).toBeVisible();
  return { context, student, assignment, post };
}

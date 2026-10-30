import "../e2e/teacher-marking.spec";
import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => {
  const origin = new URL(page.url()).origin;
  const response = await page.request.delete(`${origin}/api/account`, {
    headers: { Origin: origin },
    data: {},
  });
  expect([200, 401]).toContain(response.status());
});

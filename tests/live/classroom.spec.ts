// Same UI contract against real HTTPS/D1; the test deletes only its own account.
import "../e2e/classroom.spec";
import { test, expect } from "@playwright/test";
test.afterEach(async ({ page }) => {
  if (!page.url().startsWith("https://")) return;
  const origin = new URL(page.url()).origin;
  const response = await page.request.delete(origin + "/api/account", {
    headers: { Origin: origin },
    data: {},
  });
  expect([200, 401]).toContain(response.status());
});

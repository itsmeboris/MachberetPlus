import { test, expect } from "@playwright/test";

test("registration explains password length before typing and allows revealing it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "יצירת חשבון מורה" }).click();
  await expect(
    page.getByText("בחרו סיסמה באורך 12 תווים לפחות", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("אפשר להשתמש בכל כתובת דואר אלקטרוני", { exact: false }),
  ).toBeVisible();
  const password = page.getByLabel("סיסמה", { exact: true });
  await expect(password).toHaveAttribute("minlength", "12");
  await password.fill("a memorable password");
  await page.getByRole("button", { name: "הצגת סיסמה", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("a memorable password");
  await page.getByRole("button", { name: "הסתרת סיסמה", exact: true }).click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(
    page.getByRole("button", { name: "יצירת החשבון", exact: true }),
  ).toBeVisible();
});

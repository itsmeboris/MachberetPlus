import { test, expect } from "@playwright/test";
import { studentFixture } from "./helpers";

function twoPagePdf() {
  const first = "BT /F1 24 Tf 30 100 Td (12 + 3) Tj ET";
  const second = "BT /F1 24 Tf 30 200 Td (20 - 4) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${first.length} >>\nstream\n${first}\nendstream`,
    `<< /Length ${second.length} >>\nstream\n${second}\nendstream`,
  ];
  let data = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(data.length);
    data += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = data.length;
  data += `xref\n0 8\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(data, "ascii");
}

test("PDF upload renders only the selected page and persists that page as the source", async ({
  page,
  browser,
}) => {
  const { context } = await studentFixture(page, browser);
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "משימה חדשה" }).click();
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({
        name: "two-pages.pdf",
        mimeType: "application/pdf",
        buffer: twoPagePdf(),
      });
    const source = page.getByAltText("דף המקור");
    const ratio = () =>
      source.evaluate(
        (image: HTMLImageElement) => image.naturalWidth / image.naturalHeight,
      );
    await expect.poll(ratio).toBeCloseTo(1.5);
    await expect(source).toHaveCount(1);
    const number = page.getByRole("spinbutton", { name: /עמוד מתוך 2/ });
    await number.fill("3");
    await expect(
      page.getByRole("button", { name: "טעינת עמוד" }),
    ).toBeDisabled();
    await number.fill("2");
    await page.getByRole("button", { name: "טעינת עמוד" }).click();
    await expect.poll(ratio).toBeCloseTo(2 / 3);
    await page.getByLabel("שם המשימה").fill("עמוד שני מתוך PDF");
    await page.getByLabel("נוסח השאלה").fill("פתרו");
    await page.getByLabel("ביטוי מתמטי").fill("20 - 4");
    await page.getByRole("button", { name: "שמירת טיוטה" }).click();
    await expect(source).toHaveAttribute("src", /\/api\/media\//);
    await expect.poll(ratio).toBeCloseTo(2 / 3);
  } finally {
    await context.close();
  }
});

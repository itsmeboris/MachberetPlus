import { expect, it } from "vitest";
import { candidates } from "../src/features/capture/recognition";

it("keeps a leading variable and complete handwritten-style equations", () => {
  const found = candidates("x + 5 = 12\n2x + 7 = 8\n3x − 6 = 4");
  expect(found.map((q) => q.math)).toEqual([
    "x + 5 = 12",
    "2x + 7 = 8",
    "3x − 6 = 4",
  ]);
  expect(found.every((q) => q.kind === "equation")).toBe(true);
});

it("does not turn noisy isolated OCR digits into plausible exercises", () => {
  expect(candidates("|\n~~\n.\n7")).toEqual([]);
});
it("preserves fully pointed Hebrew when filtering OCR noise", () => {
  expect(candidates("כִּי")[0]?.prompt).toBe("כִּי");
});

import { expect, it } from "vitest";
import { formulaProposals } from "../src/features/capture/local-formula/result";

it("preserves transcribed values without solving equations or guessing symbols", () => {
  expect(
    formulaProposals(["x + 5 = 1 2", "2 x + 7 = 8", "3 x - 6 = 4"]).map(
      (q) => q.math,
    ),
  ).toEqual(["x+5=12", "2x+7=8", "3x-6=4"]);
  expect(formulaProposals(["3 x - 6 = y"])[0].math).toBe("3x-6=y");
});

it("translates supported math notation without discarding unknown LaTeX", () => {
  expect(formulaProposals([String.raw`\frac{1}{2} + 0.5 = 1`])[0].math).toBe(
    "(1)/(2)+0.5=1",
  );
  expect(formulaProposals([String.raw`x^{2}\times 3\leq 4`])[0].math).toBe(
    "x^{2}×3≤4",
  );
  expect(() =>
    formulaProposals([String.raw`\begin{matrix}1&2\end{matrix}`]),
  ).toThrow();
  expect(() => formulaProposals([String.raw`1 \frac{1}{2}`])).toThrow();
  expect(() => formulaProposals([String.raw`-1\frac{1}{2}`])).toThrow();
  expect(() => formulaProposals([String.raw`1\,\frac{1}{2}`])).toThrow();
  expect(() => formulaProposals([String.raw`1\quad \frac{1}{2}`])).toThrow();
  expect(() => formulaProposals(["", " "])).toThrow();
  expect(() => formulaProposals(["x".repeat(1001)])).toThrow();
});

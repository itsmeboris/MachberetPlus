import { expect, it } from "vitest";
import { DwellActivation, mathSpeech } from "../src/accessibility/interaction";
it("activates only once per dwell, cancels on leaving, and honors pause/device mode", () => {
  const dwell = new DwellActivation(1000);
  dwell.update("a", 0);
  expect(dwell.update("a", 500).progress).toBe(0.5);
  expect(dwell.update("a", 1000).activate).toBe(true);
  expect(dwell.update("a", 1500).activate).toBe(false);
  dwell.update(null, 1600);
  dwell.update("a", 1700);
  expect(dwell.update("a", 2500).activate).toBe(false);
  expect(dwell.update("a", 2800, false).activate).toBe(false);
  expect(dwell.update("a", 4000, true).activate).toBe(false);
  expect(dwell.update("a", 5000, true).activate).toBe(true);
});
it("preserves Nikud and speaks fractions, arithmetic and equations with Hebrew operators", () => {
  expect(mathSpeech("שָׁלוֹם")).toBe("שָׁלוֹם");
  expect(mathSpeech("2x + 5 = 15")).toBe("2 איקס ועוד 5 שווה 15");
  expect(mathSpeech("1/2 + 1/4")).toBe("1 חלקי 2 ועוד 1 חלקי 4");
  expect(mathSpeech("12 - 3 × 2")).toBe("12 פחות 3 כפול 2");
});

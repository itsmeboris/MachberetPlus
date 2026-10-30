import { describe, expect, it } from "vitest";
import { moveCorner, fullImageCorners } from "../src/features/capture/geometry";

describe("crop corner movement", () => {
  it("accepts a touch position inside the page without changing other corners", () => {
    const original = fullImageCorners();
    const moved = moveCorner(original, 0, { x: 12, y: 18 });
    expect(moved[0]).toEqual({ x: 12, y: 18 });
    expect(moved.slice(1)).toEqual(original.slice(1));
    expect(original[0]).toEqual({ x: 0, y: 0 });
  });
  it("clamps movement at the image boundary", () => {
    expect(moveCorner(fullImageCorners(), 0, { x: -8, y: 12 })[0]).toEqual({
      x: 0,
      y: 12,
    });
  });
  it("rejects crossed, collapsed and nonfinite corners", () => {
    const original = fullImageCorners();
    for (const point of [
      { x: 100, y: 100 },
      { x: 100, y: 0 },
      { x: NaN, y: 5 },
    ]) {
      expect(moveCorner(original, 0, point)).toEqual(original);
    }
  });
});

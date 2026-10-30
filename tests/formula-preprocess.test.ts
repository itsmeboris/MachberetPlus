import { describe, expect, it } from "vitest";
import {
  findFormulaLines,
  locateFormulaPage,
} from "../src/features/capture/local-formula/preprocess";

function paper(color: number[], angle = 0) {
  const width = 240,
    height = 240;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = (x - 120) * Math.cos(angle) + (y - 120) * Math.sin(angle);
      const v = -(x - 120) * Math.sin(angle) + (y - 120) * Math.cos(angle);
      const inside = Math.abs(u) < 72 && Math.abs(v) < 88;
      data.set([...(inside ? color : [55, 42, 33]), 255], (y * width + x) * 4);
    }
  return { width, height, data };
}

describe("formula preprocessing", () => {
  for (const color of [
    [245, 245, 245],
    [140, 190, 80],
    [210, 140, 180],
  ]) {
    for (const rotation of [0, 0.35, -0.35]) {
      it(`locates ${color} paper at rotation ${rotation}`, () => {
        const corners = locateFormulaPage(paper(color, rotation));
        expect(corners).toHaveLength(4);
        expect(
          Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y),
        ).toBeGreaterThan(130);
        expect(corners[0].y).toBeLessThan(70);
      });
    }
  }
  it("segments ink rows with superscripts into three padded lines", () => {
    const input = paper([250, 250, 250]);
    input.data.fill(255);
    for (const top of [40, 100, 160]) {
      for (let y = top; y < top + 18; y++)
        for (let x = 30; x < 180; x++) {
          if (x % 20 < 4 || y % 15 < 3)
            input.data.set([20, 20, 20, 255], (y * 240 + x) * 4);
        }
      for (let y = top - 9; y < top - 3; y++)
        for (let x = 65; x < 70; x++)
          input.data.set([20, 20, 20, 255], (y * 240 + x) * 4);
    }
    const lines = findFormulaLines(input);
    expect(lines).toHaveLength(3);
    expect(lines[0].y).toBeLessThan(31);
    expect(lines[0].height).toBeGreaterThan(27);
  });
  it("rejects blank input", () => {
    const input = paper([255, 255, 255]);
    input.data.fill(255);
    expect(() => findFormulaLines(input)).toThrow(/לא זוהו/);
  });
  it("accepts an already cropped single equation without mutating its pixels", () => {
    const input = paper([255, 255, 255]);
    input.data.fill(255);
    for (let y = 100; y < 125; y++)
      for (let x = 40; x < 180; x++) {
        if (x % 20 < 4) input.data.set([15, 15, 15, 255], (y * 240 + x) * 4);
      }
    const before = input.data.slice();
    expect(locateFormulaPage(input)).toHaveLength(4);
    expect(findFormulaLines(input)).toHaveLength(1);
    expect(input.data).toEqual(before);
  });
  it("rejects a scene without a coherent paper region", () => {
    const input = paper([255, 255, 255]);
    let seed = 1234;
    for (let i = 0; i < input.data.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        input.data[i + k] = seed >>> 24;
      }
    }
    expect(() => locateFormulaPage(input)).toThrow(/חתכו/);
  });
});

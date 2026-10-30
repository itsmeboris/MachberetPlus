import { expect, it } from "vitest";
import { perspectiveMap } from "../src/features/capture/geometry";
import { candidates } from "../src/features/capture/recognition";
it("maps a rectangular output to a perspective source quadrilateral", () => {
  const corners = [
    { x: 10, y: 20 },
    { x: 110, y: 20 },
    { x: 90, y: 100 },
    { x: 30, y: 100 },
  ];
  expect(perspectiveMap(corners, 0, 0)).toEqual({ x: 10, y: 20 });
  expect(perspectiveMap(corners, 1, 1).x).toBeCloseTo(90);
  expect(perspectiveMap(corners, 1, 1).y).toBeCloseTo(100);
  expect(perspectiveMap(corners, 0.5, 0.5).x).toBeCloseTo(60);
  expect(perspectiveMap(corners, 0.5, 0.5).y).toBeCloseTo(70);
});
it("keeps Hebrew vowel marks and distinguishes supported math candidates", () => {
  const result = candidates(
    "1. כִּתְבוּ שֵׁם\n2. 12 + 3 =\n3. 1/2 + 1/4\n4. 2x + 5 = 15",
  );
  expect(result).toHaveLength(4);
  expect(result[0].prompt).toBe("כִּתְבוּ שֵׁם");
  expect(result[1].math).toBe("12 + 3 =");
  expect(result[2].kind).toBe("fraction");
  expect(result[3].kind).toBe("equation");
  expect(candidates("  \n ")).toEqual([]);
});

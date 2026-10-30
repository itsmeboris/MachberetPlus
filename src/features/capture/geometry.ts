export type Point = { x: number; y: number };
export function perspectiveMap(c: Point[], u: number, v: number): Point {
  if (c.length !== 4) throw new Error("Four corners required");
  const [p0, p1, p2, p3] = c;
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x,
    dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y,
    dy3 = p0.y - p1.y + p2.y - p3.y;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < 1e-9) throw new Error("Invalid corners");
  const g = (dx3 * dy2 - dx2 * dy3) / determinant,
    h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const denominator = g * u + h * v + 1;
  return {
    x:
      ((p1.x - p0.x + g * p1.x) * u + (p3.x - p0.x + h * p3.x) * v + p0.x) /
      denominator,
    y:
      ((p1.y - p0.y + g * p1.y) * u + (p3.y - p0.y + h * p3.y) * v + p0.y) /
      denominator,
  };
}

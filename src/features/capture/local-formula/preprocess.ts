import { perspectiveMap, type Point } from "../geometry";

type Pixels = Pick<ImageData, "width" | "height" | "data">;
type Box = { x: number; y: number; width: number; height: number };
const CROP_HELP =
  "לא ניתן לזהות בבטחה את גבולות הדף. חתכו את התמונה סביב הדף או סביב משוואה אחת ונסו שוב.";
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const luminance = (data: Uint8ClampedArray, i: number) =>
  0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

/** Assumes a mostly uniform sheet near the image centre, with darker ink.
 * It deliberately rejects uncertain page boundaries; manual cropping remains available.
 * Coordinates refer to the provided image, which should already be bounded in size. */
export function locateFormulaPage(input: Pixels): Point[] {
  const { width: w, height: h, data } = input;
  const step = Math.max(1, Math.ceil(Math.max(w, h) / 320));
  const sw = Math.ceil(w / step),
    sh = Math.ceil(h / step);
  const bins = new Map<
    string,
    { count: number; r: number; g: number; b: number }
  >();
  for (let y = Math.floor(sh * 0.25); y < sh * 0.75; y++)
    for (let x = Math.floor(sw * 0.25); x < sw * 0.75; x++) {
      const i = (Math.min(h - 1, y * step) * w + Math.min(w - 1, x * step)) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        sum = r + g + b || 1;
      const key = `${Math.round((r / sum) * 16)},${Math.round((g / sum) * 16)},${Math.floor(Math.max(r, g, b) / 48)}`;
      const bin = bins.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
      bin.count++;
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bins.set(key, bin);
    }
  const best = [...bins.values()].sort((a, b) => b.count - a.count)[0];
  if (!best) throw new Error(CROP_HELP);
  const ref = [best.r / best.count, best.g / best.count, best.b / best.count];
  const sum = ref.reduce((a, b) => a + b),
    brightness = Math.max(...ref);
  const mask = new Uint8Array(sw * sh);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const i = (Math.min(h - 1, y * step) * w + Math.min(w - 1, x * step)) * 4;
      const s = data[i] + data[i + 1] + data[i + 2] || 1;
      const chroma = Math.hypot(
        data[i] / s - ref[0] / sum,
        data[i + 1] / s - ref[1] / sum,
        data[i + 2] / s - ref[2] / sum,
      );
      const light = Math.max(data[i], data[i + 1], data[i + 2]);
      if (
        chroma < 0.075 &&
        light > brightness * 0.64 &&
        light < brightness * 1.5
      )
        mask[y * sw + x] = 1;
    }
  let largest: number[] = [];
  for (let seed = 0; seed < mask.length; seed++) {
    if (!mask[seed]) continue;
    const queue = [seed];
    mask[seed] = 0;
    for (let head = 0; head < queue.length; head++) {
      const p = queue[head],
        x = p % sw,
        y = Math.floor(p / sw);
      for (const n of [
        x > 0 ? p - 1 : -1,
        x + 1 < sw ? p + 1 : -1,
        y > 0 ? p - sw : -1,
        y + 1 < sh ? p + sw : -1,
      ])
        if (n >= 0 && mask[n]) {
          mask[n] = 0;
          queue.push(n);
        }
    }
    if (queue.length > largest.length) largest = queue;
  }
  if (largest.length < sw * sh * 0.18) throw new Error(CROP_HELP);
  const points = largest
    .map((p) => ({ x: (p % sw) * step, y: Math.floor(p / sw) * step }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Point[] = [],
    upper: Point[] = [];
  for (const p of points) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0)
      lower.pop();
    lower.push(p);
  }
  for (const p of [...points].reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0)
      upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  while (hull.length > 4) {
    let index = 0,
      area = Infinity;
    for (let i = 0; i < hull.length; i++) {
      const a = Math.abs(
        cross(
          hull[(i + hull.length - 1) % hull.length],
          hull[i],
          hull[(i + 1) % hull.length],
        ),
      );
      if (a < area) {
        area = a;
        index = i;
      }
    }
    hull.splice(index, 1);
  }
  if (hull.length !== 4) throw new Error(CROP_HELP);
  let first = 0;
  for (let i = 1; i < 4; i++)
    if (hull[i].x + hull[i].y < hull[first].x + hull[first].y) first = i;
  const corners = [...hull.slice(first), ...hull.slice(0, first)];
  const area =
    Math.abs(
      corners.reduce(
        (s, p, i) =>
          s + p.x * corners[(i + 1) % 4].y - p.y * corners[(i + 1) % 4].x,
        0,
      ),
    ) / 2;
  const coverage = (largest.length * step * step) / area;
  if (coverage < 0.82 || coverage > 1.2) throw new Error(CROP_HELP);
  return corners;
}

/** Horizontal whitespace segmentation after perspective correction. Closely spaced
 * superscripts/fraction bars stay with their row; max 30 rows bounds model work. */
export function findFormulaLines(input: Pixels): Box[] {
  const { width: w, height: h, data } = input;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4)
    histogram[Math.round(luminance(data, i))]++;
  let count = 0,
    background = 255;
  for (let i = 0; i < 256; i++) {
    count += histogram[i];
    if (count > w * h * 0.75) {
      background = i;
      break;
    }
  }
  const threshold = background * 0.74,
    margin = Math.max(2, Math.round(Math.min(w, h) * 0.018));
  const rows = new Uint32Array(h),
    ink = new Uint8Array(w * h);
  for (let y = margin; y < h - margin; y++)
    for (let x = margin; x < w - margin; x++)
      if (luminance(data, (y * w + x) * 4) < threshold) {
        ink[y * w + x] = 1;
        rows[y]++;
      }
  const active = [];
  for (let y = 0; y < h; y++)
    if (rows[y] >= Math.max(2, w * 0.004)) active.push(y);
  if (active.length < 3)
    throw new Error("לא זוהו משוואות בתמונה. חתכו סביב הכתב ונסו שוב.");
  const gap = Math.max(6, Math.round(h * 0.018)),
    groups: { top: number; bottom: number }[] = [];
  for (const y of active) {
    const last = groups.at(-1);
    if (last && y - last.bottom <= gap) last.bottom = y;
    else groups.push({ top: y, bottom: y });
  }
  const boxes: Box[] = [];
  for (const { top, bottom } of groups) {
    let left = w,
      right = 0,
      total = 0;
    for (let y = top; y <= bottom; y++)
      for (let x = margin; x < w - margin; x++)
        if (ink[y * w + x]) {
          left = Math.min(left, x);
          right = Math.max(right, x);
          total++;
        }
    if (bottom - top < 3 || right - left < 8 || total < 20) continue;
    const pad = Math.max(8, Math.round((bottom - top) * 0.2));
    const x = Math.max(0, left - pad),
      y = Math.max(0, top - pad);
    boxes.push({
      x,
      y,
      width: Math.min(w, right + pad + 1) - x,
      height: Math.min(h, bottom + pad + 1) - y,
    });
  }
  if (!boxes.length)
    throw new Error("לא זוהו משוואות בתמונה. חתכו סביב הכתב ונסו שוב.");
  if (boxes.length > 30)
    throw new Error("זוהו יותר מדי שורות. חתכו לחלק קטן יותר של הדף ונסו שוב.");
  return boxes;
}

function canvas(width: number, height: number) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const context = c.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("הדפדפן אינו תומך בעיבוד תמונה");
  return { c, context };
}

export async function prepareFormulaLines(blob: Blob): Promise<ImageData[]> {
  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const { c, context } = canvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
    context.fillStyle = "#fff";
    context.fillRect(0, 0, c.width, c.height);
    context.drawImage(bitmap, 0, 0, c.width, c.height);
    const source = context.getImageData(0, 0, c.width, c.height),
      corners = locateFormulaPage(source);
    const width = Math.max(
      1,
      Math.round(
        Math.max(
          Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y),
          Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y),
        ),
      ),
    );
    const height = Math.max(
      1,
      Math.round(
        Math.max(
          Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y),
          Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y),
        ),
      ),
    );
    const page = canvas(width, height),
      rectified = page.context.createImageData(width, height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = perspectiveMap(
          corners,
          x / Math.max(1, width - 1),
          y / Math.max(1, height - 1),
        );
        const sx = Math.max(0, Math.min(source.width - 1, p.x)),
          sy = Math.max(0, Math.min(source.height - 1, p.y));
        const x0 = Math.floor(sx),
          y0 = Math.floor(sy),
          x1 = Math.min(source.width - 1, x0 + 1),
          y1 = Math.min(source.height - 1, y0 + 1),
          fx = sx - x0,
          fy = sy - y0;
        for (let k = 0; k < 3; k++)
          rectified.data[(y * width + x) * 4 + k] =
            (1 - fy) *
              ((1 - fx) * source.data[(y0 * source.width + x0) * 4 + k] +
                fx * source.data[(y0 * source.width + x1) * 4 + k]) +
            fy *
              ((1 - fx) * source.data[(y1 * source.width + x0) * 4 + k] +
                fx * source.data[(y1 * source.width + x1) * 4 + k]);
        rectified.data[(y * width + x) * 4 + 3] = 255;
      }
    page.context.putImageData(rectified, 0, 0);
    return findFormulaLines(rectified).map((box) => {
      const output = canvas(384, 384);
      output.context.imageSmoothingEnabled = true;
      output.context.imageSmoothingQuality = "high";
      output.context.drawImage(
        page.c,
        box.x,
        box.y,
        box.width,
        box.height,
        0,
        0,
        384,
        384,
      );
      return output.context.getImageData(0, 0, 384, 384);
    });
  } finally {
    bitmap.close();
  }
}

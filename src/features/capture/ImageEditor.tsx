import { useState } from "react";
import { perspectiveMap, type Point } from "./geometry";
import { ErrorMessage, useAction } from "../../components/Common";
export async function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("לא ניתן להכין תמונה"))),
      "image/jpeg",
      0.9,
    ),
  );
}
export function ImageEditor({
  url,
  onChange,
}: {
  url: string;
  onChange: (blob: Blob) => void;
}) {
  const [corners, setCorners] = useState<Point[]>([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]);
  const [editing, setEditing] = useState(false);
  const { run, error, busy } = useAction();
  async function transform(rotate: boolean) {
    const img = new Image();
    img.src = url;
    await img.decode();
    const source = document.createElement("canvas");
    source.width = img.naturalWidth;
    source.height = img.naturalHeight;
    const ctx = source.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const out = document.createElement("canvas");
    if (rotate) {
      out.width = source.height;
      out.height = source.width;
      const c = out.getContext("2d")!;
      c.translate(out.width, 0);
      c.rotate(Math.PI / 2);
      c.drawImage(source, 0, 0);
    } else {
      const pts = corners.map((p) => ({
        x: (p.x / 100) * (source.width - 1),
        y: (p.y / 100) * (source.height - 1),
      }));
      const cross = pts.map((p, i) => {
        const a = pts[(i + 1) % 4],
          b = pts[(i + 2) % 4];
        return (a.x - p.x) * (b.y - a.y) - (a.y - p.y) * (b.x - a.x);
      });
      if (cross.some((x) => x <= 0))
        throw new Error("יש לסדר ארבע פינות בכיוון השעון, ללא חצייה");
      out.width = Math.max(
        1,
        Math.round(
          Math.max(
            Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
            Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y),
          ),
        ),
      );
      out.height = Math.max(
        1,
        Math.round(
          Math.max(
            Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y),
            Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y),
          ),
        ),
      );
      const input = ctx.getImageData(0, 0, source.width, source.height);
      const dest = out.getContext("2d")!.createImageData(out.width, out.height);
      for (let y = 0; y < out.height; y++)
        for (let x = 0; x < out.width; x++) {
          const p = perspectiveMap(
            pts,
            x / Math.max(out.width - 1, 1),
            y / Math.max(out.height - 1, 1),
          );
          const s =
            (Math.max(0, Math.min(source.height - 1, Math.round(p.y))) *
              source.width +
              Math.max(0, Math.min(source.width - 1, Math.round(p.x)))) *
            4;
          const d = (y * out.width + x) * 4;
          dest.data.set(input.data.subarray(s, s + 4), d);
        }
      out.getContext("2d")!.putImageData(dest, 0, 0);
    }
    onChange(await canvasBlob(out));
    setCorners([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);
    setEditing(false);
  }
  return (
    <>
      <div className="source-preview">
        <img src={url} alt="דף המקור" />
        {editing && (
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              points={corners.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="#1d4ed822"
              stroke="#1d4ed8"
              strokeWidth=".6"
            />
          </svg>
        )}
      </div>
      <div className="actions">
        <button disabled={busy} onClick={() => run(() => transform(true))}>
          ↻ סיבוב
        </button>
        <button onClick={() => setEditing(!editing)}>חיתוך ותיקון זווית</button>
      </div>
      {editing && (
        <fieldset>
          <legend>פינות הדף באחוזים — משמאל למעלה, בכיוון השעון</legend>
          {corners.map((p, i) => (
            <div className="corner-inputs" key={i}>
              {(["x", "y"] as const).map((axis) => (
                <label key={axis}>
                  פינה {i + 1} · {axis}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={p[axis]}
                    onChange={(e) =>
                      setCorners((old) =>
                        old.map((c, n) =>
                          n === i
                            ? {
                                ...c,
                                [axis]: Math.max(
                                  0,
                                  Math.min(100, Number(e.target.value)),
                                ),
                              }
                            : c,
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
          ))}
          <button disabled={busy} onClick={() => run(() => transform(false))}>
            החלת החיתוך והתיקון
          </button>
        </fieldset>
      )}
      <ErrorMessage error={error} />
    </>
  );
}

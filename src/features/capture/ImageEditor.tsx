import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { fullImageCorners, moveCorner, perspectiveMap } from "./geometry";
import { ErrorMessage, useAction } from "../../components/Common";
import "./ImageEditor.css";
const cornerNames = [
  "שמאלית עליונה",
  "ימנית עליונה",
  "ימנית תחתונה",
  "שמאלית תחתונה",
];
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
  const [corners, setCorners] = useState(fullImageCorners);
  const [selectedCorner, setSelectedCorner] = useState(0);
  const [rotatedUrl, setRotatedUrl] = useState<string>();
  const preview = useRef<HTMLDivElement>(null);
  const helpId = useId();
  useEffect(
    () => () => {
      if (rotatedUrl) URL.revokeObjectURL(rotatedUrl);
    },
    [rotatedUrl],
  );
  useEffect(() => {
    setRotatedUrl(undefined);
    setCorners(fullImageCorners());
    setSelectedCorner(0);
    setEditing(false);
  }, [url]);
  const [editing, setEditing] = useState(false);
  const { run, error, busy } = useAction();
  function reset() {
    setRotatedUrl(undefined);
    setCorners(fullImageCorners());
    setSelectedCorner(0);
  }
  function nudge(index: number, dx: number, dy: number) {
    setCorners((old) =>
      moveCorner(old, index, {
        x: old[index].x + dx,
        y: old[index].y + dy,
      }),
    );
  }
  function drag(event: PointerEvent<HTMLButtonElement>, index: number) {
    if (busy || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const box = preview.current?.getBoundingClientRect();
    if (!box?.width || !box.height) return;
    setCorners((old) =>
      moveCorner(old, index, {
        x: ((event.clientX - box.left) / box.width) * 100,
        y: ((event.clientY - box.top) / box.height) * 100,
      }),
    );
  }
  async function transform(rotate: boolean) {
    const img = new Image();
    img.src = rotatedUrl ?? url;
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
    const blob = await canvasBlob(out);
    if (rotate) {
      setRotatedUrl(URL.createObjectURL(blob));
      // Rotate the current selection with the photograph and restore clockwise order.
      setCorners((old) =>
        [old[3], old[0], old[1], old[2]].map((p) => ({ x: 100 - p.y, y: p.x })),
      );
    } else {
      onChange(blob);
      reset();
      setEditing(false);
    }
  }
  return (
    <>
      <div className="image-editor-frame">
        <div className="source-preview image-editor-preview" ref={preview}>
          <img src={rotatedUrl ?? url} alt="דף המקור" draggable={false} />
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
          {editing &&
            corners.map((p, i) => (
              <button
                key={i}
                type="button"
                className="image-corner"
                disabled={busy}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                aria-label={`פינה ${i + 1} — ${cornerNames[i]}`}
                aria-pressed={selectedCorner === i}
                aria-describedby={helpId}
                onFocus={() => setSelectedCorner(i)}
                onClick={() => setSelectedCorner(i)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.focus();
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => drag(event, i)}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onKeyDown={(event) => {
                  const directions: Record<string, [number, number]> = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, -1],
                    ArrowDown: [0, 1],
                  };
                  const direction = directions[event.key];
                  if (!direction) return;
                  event.preventDefault();
                  const step = event.shiftKey ? 5 : 1;
                  nudge(i, direction[0] * step, direction[1] * step);
                }}
              >
                <span aria-hidden="true">{i + 1}</span>
              </button>
            ))}
        </div>
      </div>
      <div className="actions">
        {!editing && (
          <button type="button" onClick={() => setEditing(true)}>
            חיתוך וסיבוב התמונה
          </button>
        )}
      </div>
      {editing && (
        <fieldset disabled={busy} className="image-editor-controls">
          <legend>התאמת התמונה</legend>
          <p id={helpId}>
            בחרו פינה והזיזו אותה בעזרת כפתורי הכיוון. כל לחיצה מזיזה באחוז אחד
            מגודל התמונה. אפשר גם לגרור פינה. במקלדת: בחרו פינה בעזרת Tab והזיזו
            אותה בעזרת החצים.
          </p>
          <label>
            בחירת פינה להזזה
            <select
              value={selectedCorner}
              onChange={(event) =>
                setSelectedCorner(Number(event.target.value))
              }
            >
              {cornerNames.map((name, index) => (
                <option key={name} value={index}>
                  פינה {index + 1} — {name}
                </option>
              ))}
            </select>
          </label>
          <div
            className="image-corner-nudges"
            role="group"
            aria-label="הזזת הפינה שנבחרה"
          >
            <button type="button" onClick={() => nudge(selectedCorner, 0, -1)}>
              <span aria-hidden="true">↑ </span>הזזה למעלה
            </button>
            <button type="button" onClick={() => nudge(selectedCorner, 0, 1)}>
              <span aria-hidden="true">↓ </span>הזזה למטה
            </button>
            <button type="button" onClick={() => nudge(selectedCorner, -1, 0)}>
              <span aria-hidden="true">← </span>הזזה שמאלה
            </button>
            <button type="button" onClick={() => nudge(selectedCorner, 1, 0)}>
              <span aria-hidden="true">→ </span>הזזה ימינה
            </button>
          </div>
          <p className="muted">השינויים יישמרו רק בלחיצה על שמירת התמונה.</p>
          <div className="actions">
            <button type="button" onClick={() => run(() => transform(true))}>
              ↻ סיבוב ימינה
            </button>
            <button type="button" onClick={reset}>
              איפוס השינויים
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => run(() => transform(false))}
            >
              שמירת התמונה
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setEditing(false);
              }}
            >
              ביטול
            </button>
          </div>
        </fieldset>
      )}
      <ErrorMessage error={error} />
    </>
  );
}

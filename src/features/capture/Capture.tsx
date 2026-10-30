import { useEffect, useState } from "react";
import { api, upload } from "../../api";
import type { Assignment, Exercise } from "../../types";
import { ErrorMessage, Panel, useAction } from "../../components/Common";
import { candidates } from "./recognition";
import { ImageEditor, canvasBlob } from "./ImageEditor";
import { AudioRecorder } from "../../components/AudioRecorder";
const blank = (): Exercise => ({
  id: crypto.randomUUID(),
  kind: "text",
  prompt: "",
  math: "",
  spokenText: "",
});
export function Capture({
  students,
  initial,
  onBack,
}: {
  students: { id: string; name: string }[];
  initial: Assignment | null;
  onBack: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? ""),
    [studentId, setStudentId] = useState(
      initial?.studentId ?? students[0]?.id ?? "",
    ),
    [exercises, setExercises] = useState<Exercise[]>(
      initial?.exercises ?? [blank()],
    ),
    [saved, setSaved] = useState<Assignment | null>(initial),
    [confirmed, setConfirmed] = useState(false),
    [source, setSource] = useState<Blob | null>(null),
    [url, setUrl] = useState(""),
    [progress, setProgress] = useState(""),
    [pdf, setPdf] = useState<File | null>(null),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1);
  const { run, busy, error } = useAction();
  useEffect(() => {
    if (!source) return;
    const u = URL.createObjectURL(source);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [source]);
  function edit(id: string, change: Partial<Exercise>) {
    setExercises((q) => q.map((e) => (e.id === id ? { ...e, ...change } : e)));
    setConfirmed(false);
  }
  async function loadFile(file: File, pageNumber = 1) {
    if (file.size > 25 * 1024 * 1024) throw new Error("בחרו קובץ קטן מ־25MB");
    if (file.type === "application/pdf") {
      setPdf(file);
      const lib = await import("pdfjs-dist");
      lib.GlobalWorkerOptions.workerSrc = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      const loadingTask = lib.getDocument({ data: await file.arrayBuffer() });
      const doc = await loadingTask.promise;
      try {
        setPages(doc.numPages);
        const p = await doc.getPage(pageNumber),
          view = p.getViewport({ scale: 1.7 });
        const canvas = document.createElement("canvas");
        canvas.width = view.width;
        canvas.height = view.height;
        await p.render({ canvas, viewport: view }).promise;
        setSource(await canvasBlob(canvas));
      } finally {
        await loadingTask.destroy();
      }
    } else {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error("בחרו תמונה או PDF");
      setPdf(null);
      const image = await createImageBitmap(file);
      const canvas = document.createElement("canvas"),
        scale = Math.min(1, 1800 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      setSource(await canvasBlob(canvas));
    }
    setConfirmed(false);
  }
  async function recognize() {
    let image = source;
    if (!image && saved?.sourceId) {
      const response = await fetch(`/api/media/${saved.sourceId}`);
      if (!response.ok) throw new Error("לא ניתן לטעון את דף המקור. נסו שוב.");
      image = await response.blob();
    }
    if (!image) return;
    setProgress("מכינים זיהוי עברית…");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("heb+eng", 1, {
      logger: (m) =>
        setProgress(`זיהוי הדף: ${Math.round((m.progress ?? 0) * 100)}%`),
    });
    try {
      const result = await worker.recognize(image);
      const proposed = candidates(result.data.text);
      if (!proposed.length)
        throw new Error(
          "לא זוהו תרגילים. אפשר לנסות תמונה ברורה יותר או להוסיף שאלה ידנית.",
        );
      setExercises(
        proposed.map((q) => ({
          ...q,
          id: crypto.randomUUID(),
          spokenText: "",
        })),
      );
      setConfirmed(false);
      setProgress("הזיהוי הושלם. בדקו ותקנו כל תרגיל מול הדף.");
    } finally {
      await worker.terminate();
    }
  }
  async function save() {
    if (
      !title.trim() ||
      !exercises.length ||
      exercises.some((q) => !q.prompt.trim())
    )
      throw new Error("הוסיפו שם למשימה ונוסח לכל שאלה");
    let a = saved;
    if (!a)
      a = await api<Assignment>("/assignments", "POST", {
        studentId,
        title,
        exercises,
      });
    else
      a = await api<Assignment>(`/assignments/${a.id}`, "PATCH", {
        contentRevision: a.contentRevision,
        title,
        exercises,
      });
    setSaved(a);
    if (source) {
      await upload(a.id, source, "source");
      a = await api<Assignment>(`/assignments/${a.id}`);
      setSaved(a);
      setSource(null);
      setUrl("");
    }
    setProgress("הטיוטה נשמרה. אשרו את התרגילים לפני השליחה.");
    return a;
  }
  return (
    <>
      <button onClick={onBack}>→ חזרה למשימות</button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">דף אחד, אפשרויות חדשות</p>
          <h1>מכינים משימה</h1>
          <p>מצלמים, בודקים, ומגישים לתלמיד בקצב שלו.</p>
        </div>
        <span className="step-label">צילום ← אישור ← שליחה</span>
      </div>
      <div className="capture-layout">
        <Panel>
          <h2>דף המקור</h2>
          <label className="upload-zone">
            ＋ צילום או העלאת דף
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void run(() => loadFile(f));
              }}
            />
          </label>
          <label className="upload-zone small">
            צילום במצלמה
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void run(() => loadFile(f));
              }}
            />
          </label>
          {pdf && (
            <label>
              עמוד מתוך {pages}
              <input
                type="number"
                min="1"
                max={pages}
                value={page}
                onChange={(e) => setPage(Number(e.target.value))}
              />
              <button
                disabled={busy || page < 1 || page > pages}
                onClick={() => run(() => loadFile(pdf, page))}
              >
                טעינת עמוד
              </button>
            </label>
          )}
          {url ? (
            <ImageEditor url={url} onChange={setSource} />
          ) : saved?.sourceId ? (
            <img
              className="source-image"
              src={`/api/media/${saved.sourceId}`}
              alt="דף המקור"
            />
          ) : (
            <p className="muted">דף מודפס ברור, עם כל ארבע הפינות בתמונה.</p>
          )}
          <button
            disabled={(!source && !saved?.sourceId) || busy}
            onClick={() => run(recognize)}
          >
            זיהוי תרגילים מהדף
          </button>
          <p className="muted">
            הזיהוי מציע בלבד. אפשר לתקן הכול או ליצור תרגילים ידנית.
          </p>
        </Panel>
        <Panel>
          <h2>התרגילים שלי</h2>
          <label>
            שם המשימה
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setConfirmed(false);
              }}
            />
          </label>
          <label>
            תלמיד
            <select
              disabled={!!saved}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {exercises.map((q, i) => (
            <fieldset key={q.id}>
              <legend>תרגיל {i + 1}</legend>
              <label>
                סוג השאלה
                <select
                  value={q.kind}
                  onChange={(e) =>
                    edit(q.id, { kind: e.target.value as Exercise["kind"] })
                  }
                >
                  <option value="text">תשובה כתובה</option>
                  <option value="arithmetic">חשבון</option>
                  <option value="vertical">חשבון במאונך</option>
                  <option value="fraction">שברים</option>
                  <option value="equation">משוואה</option>
                </select>
              </label>
              <label>
                נוסח השאלה
                <textarea
                  value={q.prompt}
                  onChange={(e) => edit(q.id, { prompt: e.target.value })}
                />
              </label>
              <label>
                ביטוי מתמטי
                <input
                  dir="ltr"
                  value={q.math}
                  onChange={(e) => edit(q.id, { math: e.target.value })}
                />
              </label>
              <details>
                <summary>התאמת ההקראה</summary>
                <label>
                  נוסח להקראה (רשות)
                  <textarea
                    value={q.spokenText}
                    onChange={(e) => edit(q.id, { spokenText: e.target.value })}
                  />
                </label>
              </details>
              <button
                onClick={() => {
                  setExercises((es) => es.filter((e) => e.id !== q.id));
                  setConfirmed(false);
                }}
              >
                הסרת תרגיל {i + 1}
              </button>
            </fieldset>
          ))}
          <button
            onClick={() => {
              setExercises((es) => [...es, blank()]);
              setConfirmed(false);
            }}
          >
            ＋ הוספת תרגיל ידני
          </button>
          <button disabled={busy} onClick={() => run(save)}>
            שמירת טיוטה
          </button>
          {saved && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api(
                      `/assignments/${saved.id}/capture-links`,
                      "DELETE",
                      {},
                    );
                    setProgress("קישורי הצילום למשימה בוטלו.");
                  })
                }
              >
                ביטול קישורי צילום מהבית
              </button>
              <AudioRecorder
                label="הוראות קוליות לתלמיד"
                onSave={async (blob, duration) => {
                  await upload(saved.id, blob, "instructions", duration);
                  setSaved(await api<Assignment>(`/assignments/${saved.id}`));
                }}
              />
              <label className="check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                בדקתי את כל התרגילים מול המקור והם מוכנים לתלמיד.
              </label>
              <button
                className="primary"
                disabled={!confirmed || busy}
                onClick={() =>
                  run(async () => {
                    const a = await save();
                    const confirmed = await api<Assignment>(
                      `/assignments/${a.id}`,
                      "PATCH",
                      {
                        confirmed: true,
                        contentRevision: a.contentRevision,
                      },
                    );
                    await api(`/assignments/${a.id}/transition`, "POST", {
                      action: "assign",
                      contentRevision: confirmed.contentRevision,
                    });
                    onBack();
                  })
                }
              >
                שליחת המשימה לתלמיד
              </button>
            </>
          )}
        </Panel>
      </div>
      <p role="status">{progress}</p>
      <ErrorMessage error={error} />
    </>
  );
}

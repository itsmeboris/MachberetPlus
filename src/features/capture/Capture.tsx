import { useEffect, useState } from "react";
import { api, ApiError, upload } from "../../api";
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
  classrooms = [],
}: {
  students: { id: string; name: string }[];
  initial: Assignment | null;
  onBack: () => void;
  classrooms?: {
    id: string;
    name: string;
    students: { id: string; name: string }[];
  }[];
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
  const [classroomId, setClassroomId] = useState(initial?.classroomId ?? "");
  const [pendingSend, setPendingSend] = useState<{
    assignment: Assignment;
    classroomId: string;
  } | null>(null);
  const [recognitionMode, setRecognitionMode] = useState("cloud");
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [cloudConsent, setCloudConsent] = useState(false);
  useEffect(() => {
    api("/recognition")
      .then((r) => {
        setCloudAvailable(r.cloudAvailable);
        if (!r.cloudAvailable) setRecognitionMode("local");
      })
      .catch(() => setRecognitionMode("local"));
  }, []);
  function changeSource(blob: Blob) {
    setSource(blob);
    setConfirmed(false);
  }
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
    if (recognitionMode === "cloud") {
      if (!cloudConsent)
        throw new Error(
          "אשרו את שליחת התמונה לזיהוי בענן או בחרו זיהוי דפוס במכשיר.",
        );
      setProgress("מזהים את התרגילים בתמונה… זה עשוי לקחת כחצי דקה.");
      const bitmap = await createImageBitmap(image);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      let data = canvas.toDataURL("image/jpeg", 0.85);
      if (data.length > 850000) data = canvas.toDataURL("image/jpeg", 0.55);
      if (data.length > 850000)
        throw new Error("התמונה גדולה מדי לזיהוי. חתכו את הרקע ונסו שוב.");
      const result = await api("/recognition", "POST", {
        image: data,
        consent: true,
      });
      setExercises(
        result.exercises.map((q: Omit<Exercise, "id" | "spokenText">) => ({
          ...q,
          id: crypto.randomUUID(),
          spokenText: "",
        })),
      );
      setConfirmed(false);
      setProgress("הזיהוי הושלם. בדקו את כל התרגילים מול התמונה לפני שליחה.");
      return;
    }
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
          "לא זוהו תרגילים ברורים. זיהוי במכשיר מיועד לדפוס; לכתב יד בחרו זיהוי צילום וכתב יד, או הוסיפו תרגיל ידנית.",
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
      exercises.some((q) => !q.prompt.trim() && !q.math.trim())
    )
      throw new Error(
        "תנו שם אחד למשימה, והוסיפו תוכן לכל תרגיל: שאלה או ביטוי מתמטי.",
      );
    const prepared = exercises.map((q) => ({
      ...q,
      prompt: q.prompt.trim() || (q.math ? "פתרו את התרגיל" : ""),
    }));
    const selectedClass = classrooms.find((c) => c.id === classroomId);
    if (classroomId && !selectedClass?.students.length)
      throw new Error("הוסיפו תלמידים לכיתה לפני הכנת המשימה.");
    let a = saved;
    if (!a)
      a = await api<Assignment>("/assignments", "POST", {
        studentId: selectedClass?.students[0]?.id ?? studentId,
        classroomId: classroomId || null,
        title,
        exercises: prepared,
      });
    else
      a = await api<Assignment>(`/assignments/${a.id}`, "PATCH", {
        contentRevision: a.contentRevision,
        classroomId: classroomId || null,
        title,
        exercises: prepared,
      });
    setSaved(a);
    setStudentId(a.studentId);
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
  async function sendPrepared(pending: {
    assignment: Assignment;
    classroomId: string;
  }) {
    const a = pending.assignment;
    if (pending.classroomId)
      await api(`/assignments/${a.id}/distribute`, "POST", {
        classroomId: pending.classroomId,
        contentRevision: a.contentRevision,
      });
    else
      try {
        await api(`/assignments/${a.id}/transition`, "POST", {
          action: "assign",
          contentRevision: a.contentRevision,
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error;
        const current = await api<Assignment>(`/assignments/${a.id}`);
        if (
          current.status === "draft" ||
          current.sourceId !== a.sourceId ||
          JSON.stringify(current.exercises) !== JSON.stringify(a.exercises)
        )
          throw error;
      }
    onBack();
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
      <fieldset
        disabled={!!pendingSend}
        style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      >
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
              <ImageEditor url={url} onChange={changeSource} />
            ) : saved?.sourceId ? (
              <ImageEditor
                url={`/api/media/${saved.sourceId}`}
                onChange={changeSource}
              />
            ) : (
              <p className="muted">דף מודפס ברור, עם כל ארבע הפינות בתמונה.</p>
            )}
            <label>
              אופן הזיהוי
              <select
                value={recognitionMode}
                onChange={(e) => setRecognitionMode(e.target.value)}
              >
                {cloudAvailable && (
                  <option value="cloud">צילום וכתב יד — זיהוי בענן</option>
                )}
                <option value="local">דף מודפס — זיהוי במכשיר</option>
              </select>
            </label>
            {recognitionMode === "cloud" && cloudAvailable ? (
              <label className="check">
                <input
                  type="checkbox"
                  checked={cloudConsent}
                  onChange={(e) => setCloudConsent(e.target.checked)}
                />
                אני מאשר/ת לשלוח את התמונה לשירות הזיהוי של Cloudflare. התוצאה
                תוצג לבדיקה שלי לפני שליחה לתלמידים.
              </label>
            ) : (
              <p className="muted">
                זיהוי במכשיר מתאים לדפוס ברור, ואינו מיועד לכתב יד.
              </p>
            )}
            <button
              disabled={
                (!source && !saved?.sourceId) ||
                busy ||
                (recognitionMode === "cloud" && !cloudConsent)
              }
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
            <p>
              נותנים שם אחד למשימה. בתוכה מוסיפים כמה תרגילים שרוצים — אין צורך
              בשם לכל תרגיל.
            </p>
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
            {classrooms.length > 0 && (
              <label>
                למי המשימה מיועדת?
                <select
                  value={classroomId}
                  onChange={(e) => setClassroomId(e.target.value)}
                >
                  <option value="">תלמיד יחיד</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.students.length} תלמידים
                    </option>
                  ))}
                </select>
              </label>
            )}
            {classroomId ? (
              <p>
                המשימה תישלח לכל תלמידי הכיתה בפעולה אחת. לכל תלמיד יישמרו
                תשובות ומשוב משלו.
              </p>
            ) : (
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
            )}
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
                  נוסח השאלה (רשות בתרגיל חשבון)
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
                    placeholder="למשל: x + 5 = 12"
                    onChange={(e) =>
                      edit(q.id, {
                        math: e.target.value,
                        ...(q.kind === "text" && e.target.value.trim()
                          ? {
                              kind: /[xy]/i.test(e.target.value)
                                ? ("equation" as const)
                                : ("arithmetic" as const),
                            }
                          : {}),
                      })
                    }
                  />
                </label>
                <details>
                  <summary>התאמת ההקראה</summary>
                  <label>
                    נוסח להקראה (רשות)
                    <textarea
                      value={q.spokenText}
                      onChange={(e) =>
                        edit(q.id, { spokenText: e.target.value })
                      }
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
                      setSaved(confirmed);
                      const pending = { assignment: confirmed, classroomId };
                      setPendingSend(pending);
                      await sendPrepared(pending);
                    })
                  }
                >
                  {classroomId
                    ? "שליחת המשימה לכל הכיתה"
                    : "שליחת המשימה לתלמיד"}
                </button>
              </>
            )}
          </Panel>
        </div>
      </fieldset>
      {pendingSend && (
        <div className="actions">
          <p>
            המשימה אושרה. אם השליחה נקטעה, אפשר לנסות שוב בלי להכין אותה מחדש.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() => run(() => sendPrepared(pendingSend))}
          >
            ניסיון נוסף בשליחת המשימה
          </button>
        </div>
      )}
      <p role="status">{progress}</p>
      <ErrorMessage error={error} />
    </>
  );
}

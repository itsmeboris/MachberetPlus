import { useState } from "react";
import { api, upload } from "../../api";
import { type Assignment, type Feedback, statuses } from "../../types";
import { Audio, ErrorMessage, Panel, useAction } from "../../components/Common";
import { AudioRecorder } from "../../components/AudioRecorder";
import { WorkRecord } from "./WorkRecord";
import { AnswerView } from "../../components/AnswerView";
export function Review({
  assignment: initial,
  onBack,
}: {
  assignment: Assignment;
  onBack: () => void;
}) {
  const [a, setA] = useState(initial),
    [feedback, setFeedback] = useState<Record<string, Feedback>>(
      initial.feedback,
    ),
    [link, setLink] = useState("");
  const [pendingAudio, setPendingAudio] = useState<Record<string, boolean>>({});
  const audioPending = Object.values(pendingAudio).some(Boolean);
  const { run, busy, error } = useAction();
  async function finish(action: "review" | "return") {
    const saved = await api(`/assignments/${a.id}/review`, "PUT", {
      feedback,
      contentRevision: a.contentRevision,
    });
    setA(
      await api(`/assignments/${a.id}/transition`, "POST", {
        action,
        contentRevision: saved.contentRevision,
      }),
    );
  }
  return (
    <>
      <button onClick={onBack}>→ חזרה למשימות</button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">מילה טובה עושה הבדל</p>
          <h1>בודקים וצומחים</h1>
          <p>
            {a.title} · {statuses[a.status]}
          </p>
        </div>
      </div>
      {a.status === "submitted" ? (
        <Panel>
          {a.exercises.map((q, i) => (
            <article className="record-question" key={q.id}>
              <h2>
                {i + 1}. {q.prompt}
              </h2>
              <p className="math" dir="ltr">
                {q.math}
              </p>
              <AnswerView question={q} answer={a.answers[q.id]} />
              <label>
                משוב כתוב
                <textarea
                  value={feedback[q.id]?.text ?? ""}
                  onChange={(e) =>
                    setFeedback((f) => ({
                      ...f,
                      [q.id]: { ...f[q.id], text: e.target.value },
                    }))
                  }
                />
              </label>
              <label>
                מדבקה
                <select
                  value={feedback[q.id]?.sticker ?? "star"}
                  onChange={(e) =>
                    setFeedback((f) => ({
                      ...f,
                      [q.id]: {
                        ...f[q.id],
                        sticker: e.target.value as Feedback["sticker"],
                      },
                    }))
                  }
                >
                  <option value="star">☆ כל הכבוד</option>
                  <option value="heart">♡ גאים בך</option>
                  <option value="effort">✧ רואים את המאמץ</option>
                </select>
              </label>
              <Audio id={feedback[q.id]?.audioId} />
              <AudioRecorder
                label={`הודעה קולית לתרגיל ${i + 1}`}
                onPendingChange={(pending) =>
                  setPendingAudio((previous) =>
                    previous[q.id] === pending
                      ? previous
                      : { ...previous, [q.id]: pending },
                  )
                }
                onSave={async (blob, duration) => {
                  const audioId = await upload(
                    a.id,
                    blob,
                    "feedback",
                    duration,
                    q.id,
                  );
                  setFeedback((f) => ({
                    ...f,
                    [q.id]: { ...f[q.id], audioId },
                  }));
                }}
              />
            </article>
          ))}
          <div className="actions">
            <button
              className="primary"
              disabled={busy || audioPending}
              onClick={() => run(() => finish("review"))}
            >
              סיום הבדיקה
            </button>
            <button
              disabled={busy || audioPending}
              onClick={() => run(() => finish("return"))}
            >
              החזרה לניסיון נוסף
            </button>
          </div>
          {audioPending && (
            <p role="status">שמרו את ההקלטה או ותרו עליה לפני סיום הבדיקה.</p>
          )}
        </Panel>
      ) : (
        <WorkRecord assignment={a} />
      )}
      <ErrorMessage error={error} />
      {["reviewed", "parent_acknowledged"].includes(a.status) && (
        <Panel>
          <h2>ממשיכים את ההצלחה בבית</h2>
          <p>
            {a.acknowledgedAt
              ? `עברו יחד בבית · ${new Date(a.acknowledgedAt).toLocaleString("he-IL")}`
              : "אפשר לשתף את העבודה שנבדקה עם ההורה."}
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const result = await api(
                  `/assignments/${a.id}/parent-links`,
                  "POST",
                  {},
                );
                setLink(`${location.origin}/p/${result.token}`);
              })
            }
          >
            יצירת קישור להורה
          </button>
          {link && (
            <>
              <label>
                קישור להורה
                <input dir="ltr" readOnly value={link} />
              </label>
              <p className="muted">הקישור תקף לשבעה ימים ולעבודה הזו בלבד.</p>
              <div className="actions">
                <a
                  className="button"
                  href={`https://wa.me/?text=${encodeURIComponent(`עבודה חדשה במחברת+ — מוזמנים לעבור יחד: ${link}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  שיתוף ב־WhatsApp
                </a>
                <button
                  onClick={() => run(() => navigator.clipboard.writeText(link))}
                >
                  העתקת הקישור
                </button>
              </div>
            </>
          )}
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api(`/assignments/${a.id}/parent-links`, "DELETE", {});
                setLink("");
              })
            }
          >
            ביטול כל קישורי ההורה למשימה
          </button>
        </Panel>
      )}
    </>
  );
}

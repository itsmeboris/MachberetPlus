import { useState } from "react";
import { api, upload } from "../../api";
import { type Assignment, type Feedback, statuses } from "../../types";
import { Audio, ErrorMessage, Panel, useAction } from "../../components/Common";
import { AudioRecorder } from "../../components/AudioRecorder";
import { WorkRecord } from "./WorkRecord";
import { AnswerView } from "../../components/AnswerView";
import { MathText } from "../../components/MathText";
import { decisionLabels } from "./decisions";
import "./Review.css";
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
  const [notice, setNotice] = useState("");
  const [pendingAudio, setPendingAudio] = useState<Record<string, boolean>>({});
  const audioPending = Object.values(pendingAudio).some(Boolean);
  const { run, busy, error } = useAction();
  async function finish(action: "review" | "return") {
    if (busy || audioPending) return;
    const saved = await api(`/assignments/${a.id}/review`, "PUT", {
      feedback,
      contentRevision: a.contentRevision,
    });
    setA(
      await api(`/assignments/${a.id}/transition`, "POST", {
        action,
        contentRevision: saved.contentRevision,
        revision: a.revision,
        expectedStatus: a.status,
      }),
    );
  }
  return (
    <div className="review-page" dir="rtl">
      <button disabled={busy || audioPending} onClick={onBack}>
        → חזרה למשימות
      </button>
      <div className="page-heading">
        <div>
          <p className="eyebrow">בדיקת עבודת התלמיד</p>
          <h1>בדיקת המשימה</h1>
          <p>
            <bdi>{a.title}</bdi>
          </p>
          <p className="status-label" role="status">
            {statuses[a.status]}
          </p>
        </div>
      </div>
      {a.status === "submitted" ? (
        <Panel>
          <p>
            עברו על התשובות וסמנו את תשובת התלמיד בכל תרגיל. אפשר להוסיף הערה,
            ואז לסיים את הבדיקה או להחזיר לתלמיד לתיקון.
          </p>
          <p className="muted">
            הסימונים וההערות נשמרים כשמסיימים את הבדיקה או מחזירים לתיקון.
            הסימון נעשה על ידי המורה; אין בדיקה אוטומטית.
          </p>
          {a.exercises.map((q, i) => (
            <article className="record-question" key={q.id}>
              <h2>
                תרגיל {i + 1}
                {q.prompt && (
                  <>
                    {" "}
                    · <bdi>{q.prompt}</bdi>
                  </>
                )}
              </h2>
              <p className="math" dir="ltr">
                <MathText value={q.math} />
              </p>
              <AnswerView question={q} answer={a.answers[q.id]} />
              <fieldset disabled={busy} className="review-decisions">
                <legend>סימון התשובה לתרגיל {i + 1}</legend>
                {(["reviewed", "retry", "unmarked"] as const).map(
                  (decision) => (
                    <label key={decision}>
                      <input
                        type="radio"
                        name={`decision-${q.id}`}
                        value={decision}
                        checked={
                          (feedback[q.id]?.decision ?? "unmarked") === decision
                        }
                        onChange={() =>
                          setFeedback((previous) => ({
                            ...previous,
                            [q.id]: {
                              ...previous[q.id],
                              decision:
                                decision === "unmarked" ? undefined : decision,
                            },
                          }))
                        }
                      />
                      {decisionLabels[decision]}
                    </label>
                  ),
                )}
              </fieldset>
              <details className="review-feedback">
                <summary>הוספת הערה לתרגיל {i + 1} (לא חובה)</summary>
                <fieldset disabled={busy} className="review-feedback-fields">
                  <legend>הערה לתלמיד</legend>
                  <label>
                    הערה כתובה
                    <textarea
                      dir="auto"
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
                    סימן עידוד
                    <select
                      value={feedback[q.id]?.sticker ?? ""}
                      onChange={(e) =>
                        setFeedback((f) => ({
                          ...f,
                          [q.id]: {
                            ...f[q.id],
                            sticker: (e.target.value ||
                              undefined) as Feedback["sticker"],
                          },
                        }))
                      }
                    >
                      <option value="">ללא סימן</option>
                      <option value="star">☆ כל הכבוד</option>
                      <option value="heart">♡ גאים בך</option>
                      <option value="effort">✧ רואים את המאמץ</option>
                    </select>
                  </label>
                  <Audio id={feedback[q.id]?.audioId} />
                  <p className="muted">
                    להערה קולית: הקליטו, עצרו ולחצו על שמירה בהקלטה. אחר כך
                    סיימו את הבדיקה או החזירו לתיקון.
                  </p>
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
                </fieldset>
              </details>
            </article>
          ))}
          <p>
            <strong>סיום הבדיקה:</strong> המשימה תסומן כנבדקה, והתלמיד יוכל
            לראות את הסימונים וההערות. סיום הבדיקה אינו מסמן אוטומטית תשובות
            כנכונות.
          </p>
          <p>
            <strong>החזרה לתיקון:</strong> התלמיד יוכל לשנות תשובות ולהגיש שוב.
          </p>
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
              החזרה לתיקון
            </button>
          </div>
          {audioPending && (
            <p role="status">שמרו את ההקלטה או ותרו עליה לפני סיום הבדיקה.</p>
          )}
        </Panel>
      ) : (
        <WorkRecord assignment={a} headingLevel={2} />
      )}
      <ErrorMessage error={error} />
      <p role="status">{notice}</p>
      {["reviewed", "parent_acknowledged"].includes(a.status) && (
        <Panel>
          <h2>תיקון העבודה לאחר הבדיקה</h2>
          <p>
            אפשר להחזיר לתלמיד כדי לשנות תשובות ולהגיש שוב. המשוב יישאר לעיון,
            וקישורי ההורה הקיימים ואישור ההורה יבוטלו עד לבדיקה ולשיתוף מחדש.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                const returned = await api<Assignment>(
                  `/assignments/${a.id}/transition`,
                  "POST",
                  {
                    action: "return",
                    contentRevision: a.contentRevision,
                    revision: a.revision,
                    expectedStatus: a.status,
                  },
                );
                setA(returned);
                setLink("");
              })
            }
          >
            החזרה לתיקון
          </button>
          <h2>שיתוף העבודה עם ההורה</h2>
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
                setNotice("הקישור להורה נוצר. אפשר להעתיק או לשתף אותו.");
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
                  aria-label="שיתוף ב־WhatsApp (נפתח בחלון חדש)"
                >
                  שיתוף ב־WhatsApp
                </a>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await navigator.clipboard.writeText(link);
                      setNotice("הקישור הועתק.");
                    })
                  }
                >
                  העתקת הקישור
                </button>
              </div>
            </>
          )}
          <button
            className="danger"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api(`/assignments/${a.id}/parent-links`, "DELETE", {});
                setLink("");
                setNotice("קישורי ההורה למשימה בוטלו.");
              })
            }
          >
            ביטול כל קישורי ההורה למשימה
          </button>
        </Panel>
      )}
    </div>
  );
}

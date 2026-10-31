import { useEffect, useId, useRef, useState } from "react";
import { api, ApiError } from "../../api";
import { type Answer, type Assignment, type User, statuses } from "../../types";
import { Audio, ErrorMessage, Panel, useAction } from "../../components/Common";
import { WorkRecord } from "../review/WorkRecord";
import { decisionLabel } from "../review/decisions";
import { usePreferences, speakHebrew } from "../../accessibility/Access";
import { MathAnswer } from "../../components/MathAnswer";
import { Keyboard } from "../../components/Keyboard";
import { MathText } from "../../components/MathText";
export function Student({ user }: { user: User }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]),
    [active, setActive] = useState<Assignment | null>(null),
    [completed, setCompleted] = useState(false),
    [index, setIndex] = useState(0);
  const { run, error } = useAction();
  async function refresh() {
    setAssignments(await api("/assignments"));
  }
  useEffect(() => {
    void run(refresh);
  }, []);
  if (active)
    return (
      <Workbook
        key={`${active.id}:${active.contentRevision}:${active.status}`}
        onReopen={setActive}
        user={user}
        assignment={active}
        onBack={() => {
          setActive(null);
          void run(refresh);
        }}
      />
    );
  const list = assignments.filter((a) =>
      completed
        ? ["submitted", "reviewed", "parent_acknowledged"].includes(a.status)
        : ["assigned", "in_progress", "returned"].includes(a.status),
    ),
    a = list[Math.min(index, list.length - 1)];
  return (
    <div className="student-home">
      <div className="page-heading">
        <div>
          <p className="eyebrow">כל צעד קטן הוא הצלחה</p>
          <h1>המשימה שלי עכשיו</h1>
        </div>
      </div>
      <div className="tabs">
        <button
          aria-pressed={!completed}
          onClick={() => {
            setCompleted(false);
            setIndex(0);
          }}
        >
          המשימות שלי
        </button>
        <button
          aria-pressed={completed}
          onClick={() => {
            setCompleted(true);
            setIndex(0);
          }}
        >
          העבודות שסיימתי
        </button>
      </div>
      {a ? (
        <>
          <p className="muted">
            משימה {index + 1} מתוך {list.length} · בקצב שלך, בלי לחץ
          </p>
          <Panel className="mission">
            <div className="mission-icon" aria-hidden="true">
              ▤
            </div>
            <p className="eyebrow">{statuses[a.status]}</p>
            <h2>{a.title}</h2>
            <p>{a.exercises.length} תרגילים · עושים צעד אחד בכל פעם</p>
            {a.instructionsId && (
              <div className="audio-card">
                <strong>הודעה מהמורה</strong>
                <Audio id={a.instructionsId} />
              </div>
            )}
            <button className="primary" onClick={() => setActive(a)}>
              {completed
                ? "צפייה בעבודה"
                : a.status === "assigned"
                  ? "התחל עבודה"
                  : "המשך עבודה"}{" "}
              <span aria-hidden="true">←</span>
            </button>
          </Panel>
          <div className="carousel-controls">
            <button
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
              aria-label="משימה קודמת"
            >
              →
            </button>
            <span>
              {index + 1} / {list.length}
            </span>
            <button
              disabled={index >= list.length - 1}
              onClick={() => setIndex((i) => i + 1)}
              aria-label="משימה הבאה"
            >
              ←
            </button>
          </div>
        </>
      ) : (
        <Panel className="empty">
          <h2>
            {completed ? "ההצלחות שלך יופיעו כאן" : "המחברת מחכה למשימה חדשה"}
          </h2>
          <p>המורה יוכל לשלוח לכאן את המשימה הבאה.</p>
          <button onClick={() => run(refresh)}>בדיקה למשימות חדשות</button>
        </Panel>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}
function Workbook({
  user,
  assignment: a,
  onBack,
  onReopen,
}: {
  user: User;
  assignment: Assignment;
  onBack: () => void;
  onReopen: (assignment: Assignment) => void;
}) {
  const editable = ["assigned", "in_progress", "returned"].includes(a.status);
  const prefs = usePreferences();
  const keyboardId = useId();
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const activeCell = useRef<string | undefined>(undefined);
  const key = `machberet:${user.id}:${a.id}`;
  const [recovered] = useState<{
    revision: number;
    answers: Record<string, Answer>;
  } | null>(() => {
    if (!editable) return null;
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      return null;
    }
  });
  const [conflict, setConflict] = useState<Assignment | null>(
    recovered && recovered.revision !== a.revision ? a : null,
  );
  const conflictRef = useRef(conflict);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => {
      return recovered?.answers ?? a.answers;
    }),
    [index, setIndex] = useState(0),
    [saveStatus, setSaveStatus] = useState(
      conflict
        ? "נמצאה גרסה אחרת. בחרו איזו גרסה לשמור."
        : recovered
          ? "תשובה מהמכשיר ממתינה לשמירה"
          : "כל השינויים נשמרו",
    ),
    [aac, setAac] = useState(false),
    [keyboard, setKeyboard] = useState(prefs.mode === "switch"),
    [focus, setFocus] = useState(prefs.spotlight);
  useEffect(() => setFocus(prefs.spotlight), [prefs.spotlight]);
  useEffect(() => {
    activeCell.current = undefined;
    questionHeading.current?.focus();
  }, [index]);
  const revision = useRef(recovered?.revision ?? a.revision),
    latest = useRef(answers),
    saving = useRef(false),
    dirty = useRef(editable && localStorage.getItem(key) !== null),
    mounted = useRef(true);
  const { run, error, busy } = useAction();
  const q = a.exercises[index];
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function changeAnswer(answer: Answer) {
    if (!editable) return;
    const next = { ...latest.current, [q.id]: answer };
    latest.current = next;
    setAnswers(next);
    dirty.current = true;
    localStorage.setItem(
      key,
      JSON.stringify({ revision: revision.current, answers: next }),
    );
    setSaveStatus("השינויים נשמרו במכשיר. ממתינים לשמירה בשרת…");
  }
  function keypress(key: string) {
    const answer = latest.current[q.id] ?? { text: "" };
    const field = activeCell.current;
    const old = field ? (answer.cells?.[field] ?? "") : answer.text;
    const value = key === "delete" ? old.slice(0, -1) : old + key;
    if (field) {
      const cells = { ...answer.cells, [field]: value.slice(-2) };
      const text = Object.keys(cells)
        .filter((k) => k.startsWith("answer-"))
        .sort()
        .map((k) => cells[k])
        .join("");
      changeAnswer({ ...answer, text, cells });
    } else changeAnswer({ ...answer, text: value });
  }
  async function persist() {
    if (!editable) return;
    if (saving.current) throw new Error("השמירה מתבצעת. המתינו רגע ונסו שוב.");
    if (conflictRef.current) throw new Error("יש לבחור איזו גרסה לשמור.");
    if (!dirty.current) return;
    saving.current = true;
    try {
      while (dirty.current) {
        const snapshot = latest.current;
        setSaveStatus("שומרים…");
        const result = await api(`/assignments/${a.id}/answers`, "PUT", {
          revision: revision.current,
          answers: snapshot,
        });
        revision.current = result.revision;
        dirty.current = snapshot !== latest.current;
        if (!dirty.current) localStorage.removeItem(key);
        else
          localStorage.setItem(
            key,
            JSON.stringify({
              revision: revision.current,
              answers: latest.current,
            }),
          );
        if (mounted.current) setSaveStatus("כל השינויים נשמרו");
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        try {
          const remote = await api<Assignment>(`/assignments/${a.id}`);
          conflictRef.current = remote;
          setConflict(remote);
        } catch {
          /* Keep the recoverable device draft if fetching the server version fails. */
        }
      }
      setSaveStatus(
        e instanceof ApiError && e.status === 409
          ? "נמצאה גרסה אחרת. התשובה במכשיר נשמרה; יש להשוות לגרסת השרת."
          : "אין חיבור לשמירה. התשובה נשמרה במכשיר — אפשר לנסות שוב.",
      );
      throw e;
    } finally {
      saving.current = false;
    }
  }
  useEffect(() => {
    if (!editable) return;
    const timer = setTimeout(() => {
      void persist().catch(() => {});
    }, 650);
    return () => clearTimeout(timer);
  }, [answers]);
  useEffect(() => {
    const online = () => void persist().catch(() => {});
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  function speak(text: string) {
    void run(async () => speakHebrew(text));
  }
  if (!editable)
    return (
      <>
        <div className="student-record-actions">
          <button onClick={onBack}>→ חזרה למשימות</button>
        </div>
        <WorkRecord assignment={a} />
        {a.status === "submitted" && Object.keys(a.feedback).length === 0 ? (
          <Panel className="student-record-actions">
            <p>
              אפשר לחזור ולתקן כל עוד המורה לא התחיל לבדוק. לאחר התיקון מגישים
              שוב.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const reopened = await api<Assignment>(
                    `/assignments/${a.id}/transition`,
                    "POST",
                    {
                      action: "withdraw",
                      revision: a.revision,
                      contentRevision: a.contentRevision,
                    },
                  );
                  localStorage.removeItem(key);
                  onReopen(reopened);
                })
              }
            >
              חזרה לתיקון התשובות
            </button>
          </Panel>
        ) : (
          <p>
            {a.status === "submitted"
              ? "המורה כבר התחיל לבדוק. כדי לתקן תשובות, בקשו מהמורה להחזיר את העבודה לתיקון."
              : "בדיקת העבודה הסתיימה. כדי לתקן תשובות, בקשו מהמורה להחזיר את העבודה לתיקון."}
          </p>
        )}
        <ErrorMessage error={error} />
      </>
    );
  return (
    <div className="workbook">
      <div className="actions">
        <button
          onClick={() =>
            run(async () => {
              await persist();
              onBack();
            })
          }
        >
          → חזרה למשימות
        </button>
        <button aria-pressed={focus} onClick={() => setFocus(!focus)}>
          מיקוד בשאלה
        </button>
      </div>
      <p className="eyebrow">
        {a.title} · שאלה {index + 1} מתוך {a.exercises.length}
      </p>
      <Panel className={`question ${focus ? "spotlight" : ""}`}>
        <div className="question-heading">
          <span className="question-number">{index + 1}</span>
          <button
            onClick={() => speak(q.spokenText || `${q.prompt} ${q.math}`)}
          >
            הקראת השאלה
          </button>
        </div>
        <h1 ref={questionHeading} tabIndex={-1}>
          {q.prompt}
        </h1>
        {q.math && (
          <div className="math" dir="ltr">
            <MathText value={q.math} />
          </div>
        )}
        <MathAnswer
          exercise={q}
          answer={answers[q.id] ?? { text: "" }}
          onChange={changeAnswer}
          onFocus={(cell) => {
            activeCell.current = cell;
          }}
        />
        {a.feedback[q.id] && (
          <div className="feedback-note">
            <h2>הודעה מהמורה</h2>
            <p>{decisionLabel(a.feedback[q.id].decision)}</p>
            <p>{a.feedback[q.id].text}</p>
            <Audio id={a.feedback[q.id].audioId} />
          </div>
        )}
        <button
          aria-expanded={keyboard}
          aria-controls={keyboardId}
          onClick={() => setKeyboard(!keyboard)}
        >
          {keyboard ? "סגירת המקלדת" : "פתיחת מקלדת"}
        </button>
        <div id={keyboardId} hidden={!keyboard}>
          {keyboard && <Keyboard text={q.kind === "text"} onKey={keypress} />}
        </div>
        <div className="actions">
          <button disabled={!index} onClick={() => setIndex((i) => i - 1)}>
            השאלה הקודמת
          </button>
          {index < a.exercises.length - 1 ? (
            <button className="primary" onClick={() => setIndex((i) => i + 1)}>
              השאלה הבאה ←
            </button>
          ) : (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await persist();
                  if (saving.current || dirty.current)
                    throw new Error("יש להמתין לסיום השמירה");
                  await api(`/assignments/${a.id}/transition`, "POST", {
                    action: "submit",
                    revision: revision.current,
                  });
                  onBack();
                })
              }
            >
              הגשה למורה
            </button>
          )}
        </div>
        <p role="status" className="save-status">
          {saveStatus}
        </p>
        {conflict && (
          <section className="conflict" aria-label="השוואת גרסאות">
            <h2>יש שתי גרסאות לעבודה</h2>
            <p>התשובה במכשיר נשמרה. בדקו לפני הבחירה.</p>
            {a.exercises.map((question) => (
              <div key={question.id}>
                <h3>{question.prompt}</h3>
                <p>במכשיר: {answers[question.id]?.text ?? "—"}</p>
                <p>בשרת: {conflict.answers[question.id]?.text ?? "—"}</p>
              </div>
            ))}
            <div className="actions">
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    revision.current = conflict.revision;
                    conflictRef.current = null;
                    setConflict(null);
                    await persist();
                  })
                }
              >
                שמירת התשובות מהמכשיר
              </button>
              <button
                onClick={() => {
                  revision.current = conflict.revision;
                  latest.current = conflict.answers;
                  setAnswers(conflict.answers);
                  dirty.current = false;
                  conflictRef.current = null;
                  setConflict(null);
                  localStorage.removeItem(key);
                  setSaveStatus("כל השינויים נשמרו");
                }}
              >
                שימוש בתשובות מהשרת
              </button>
            </div>
          </section>
        )}
        {saveStatus.includes("אפשר לנסות") && (
          <button onClick={() => run(persist)}>ניסיון שמירה נוסף</button>
        )}
        <ErrorMessage error={error} />
      </Panel>
      <div className="aac">
        <button aria-expanded={aac} onClick={() => setAac(!aac)}>
          תקשורת ועזרה
        </button>
        {aac && (
          <div className="actions">
            {[
              "אני צריך עזרה",
              "לא הבנתי, אפשר להסביר?",
              "אני רוצה הפסקה",
              "סיימתי",
            ].map((text) => (
              <button key={text} onClick={() => speak(text)}>
                {text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

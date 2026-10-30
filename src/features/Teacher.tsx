import { useEffect, useState } from "react";
import { api } from "../api";
import { type Assignment, statuses } from "../types";
import { ErrorMessage, Panel, useAction } from "../components/Common";
import { Capture } from "./capture/Capture";
import { Review } from "./review/Review";
import { Pilot } from "./pilot/Pilot";
export function Teacher() {
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]),
    [assignments, setAssignments] = useState<Assignment[]>([]),
    [view, setView] = useState<"home" | "create" | "review" | "pilot">("home"),
    [selected, setSelected] = useState<Assignment | null>(null),
    [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [consent, setConsent] = useState(false),
    [pair, setPair] = useState(""),
    [captureLink, setCaptureLink] = useState("");
  const { run, busy, error } = useAction();
  async function refresh() {
    const [s, a] = await Promise.all([api("/students"), api("/assignments")]);
    setStudents(s);
    setAssignments(a);
  }
  useEffect(() => {
    void run(refresh);
  }, []);
  const back = () => {
    setView("home");
    setSelected(null);
    void run(refresh);
  };
  if (view === "pilot") return <Pilot students={students} onBack={back} />;
  if (view === "create")
    return <Capture students={students} initial={selected} onBack={back} />;
  if (view === "review" && selected)
    return <Review assignment={selected} onBack={back} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">כל ילד והדרך שלו</p>
          <h1>סביבת המורה</h1>
          <p className="muted">מכינים משימה, מלווים את הדרך, ומחזקים הצלחות.</p>
        </div>
        <button
          className="primary"
          disabled={!students.length}
          onClick={() => {
            setSelected(null);
            setView("create");
          }}
        >
          ＋ משימה חדשה
        </button>
      </div>
      <div className="teacher-layout">
        <Panel>
          <h2>המשימות שלנו</h2>
          {!assignments.length && (
            <div className="empty">
              <span aria-hidden="true">▤</span>
              <h3>הכול מתחיל בדף אחד</h3>
              <p>הוסיפו תלמיד והכינו את המשימה הראשונה.</p>
            </div>
          )}
          {assignments.map((a) => (
            <article className="assignment-row" key={a.id}>
              <div>
                <span className="status-label">{statuses[a.status]}</span>
                <h3>{a.title}</h3>
                <p>
                  {students.find((s) => s.id === a.studentId)?.name} ·{" "}
                  {a.exercises.length} תרגילים
                </p>
              </div>
              <button
                onClick={() => {
                  setSelected(a);
                  setView(a.status === "draft" ? "create" : "review");
                }}
              >
                {a.status === "draft"
                  ? "המשך הכנה"
                  : a.status === "submitted"
                    ? "בדיקת העבודה"
                    : "צפייה בעבודה"}
              </button>
            </article>
          ))}
        </Panel>
        <aside>
          <Panel>
            <button onClick={() => setView("pilot")}>
              תצפיות ודוח הפיילוט
            </button>
            <h2>התלמידים שלי</h2>
            {captureLink && (
              <label>
                קישור לצילום בבית
                <input dir="ltr" readOnly value={captureLink} />
                <small>
                  הקישור תקף ליום אחד, לצילום בלבד. התרגילים יאושרו כאן לפני
                  שליחה.
                </small>
              </label>
            )}
            {students.map((s) => (
              <div className="student-row" key={s.id}>
                <span className="avatar" aria-hidden="true">
                  {s.name.slice(0, 1)}
                </span>
                <strong>{s.name}</strong>
                <button
                  onClick={() =>
                    run(async () => {
                      const draft = await api("/assignments", "POST", {
                        studentId: s.id,
                        title: "דף לצילום בבית",
                        exercises: [],
                      });
                      const ticket = await api(
                        `/assignments/${draft.id}/capture-links`,
                        "POST",
                        {},
                      );
                      setCaptureLink(`${location.origin}/c/${ticket.token}`);
                      await refresh();
                    })
                  }
                >
                  בקשת צילום מהורה
                </button>
                <button
                  aria-label={`קישור כניסה עבור ${s.name}`}
                  onClick={() =>
                    run(async () => {
                      const { code } = await api(
                        `/students/${s.id}/pair`,
                        "POST",
                        {},
                      );
                      setPair(`${location.origin}/?join=${code}`);
                    })
                  }
                >
                  קישור כניסה
                </button>
                <button
                  aria-label={`מחיקת ${s.name}`}
                  onClick={() => {
                    if (confirm("למחוק את התלמיד וכל עבודותיו?"))
                      void run(async () => {
                        await api(`/students/${s.id}`, "DELETE", {});
                        await refresh();
                      });
                  }}
                >
                  מחיקה
                </button>
              </div>
            ))}
            <button onClick={() => setAdding(!adding)}>＋ הוספת תלמיד</button>
            {adding && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const s = await api("/students", "POST", { name, consent });
                    setPair(`${location.origin}/?join=${s.code}`);
                    setAdding(false);
                    setName("");
                    setConsent(false);
                    await refresh();
                  });
                }}
              >
                <label>
                  שם התלמיד
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  קיבלתי הסכמת הורה/אפוטרופוס לשמירת העבודה והמשוב לפיילוט.
                </label>
                <button disabled={busy}>שמירת התלמיד</button>
              </form>
            )}
            {pair && (
              <label>
                קישור כניסה לתלמיד
                <input dir="ltr" readOnly value={pair} />
                <small>חד פעמי, תקף ל־15 דקות. פתחו במכשיר התלמיד.</small>
              </label>
            )}
          </Panel>
          <p className="muted">צילום ומיקרופון מופעלים רק לפי בקשה מפורשת.</p>
          <details>
            <summary>פרטיות ומחיקת מידע</summary>
            <p>
              אפשר להסיר תלמיד ואת עבודותיו עם ביטול ההסכמה. מחיקת החשבון תסיר
              את כל התלמידים, העבודות, ההקלטות והתצפיות שלו.
            </p>
            <button
              disabled={busy}
              onClick={() => {
                if (confirm("למחוק לצמיתות את החשבון ואת כל המידע שלו?"))
                  void run(async () => {
                    await api("/account", "DELETE", {});
                    location.replace("/");
                  });
              }}
            >
              מחיקת החשבון וכל המידע
            </button>
          </details>
        </aside>
      </div>
      <ErrorMessage error={error} />
    </>
  );
}

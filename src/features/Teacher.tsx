import { useEffect, useState } from "react";
import { api } from "../api";
import { type Assignment, statuses } from "../types";
import { ErrorMessage, Panel, useAction } from "../components/Common";
import { Capture } from "./capture/Capture";
import { Review } from "./review/Review";
import { Pilot } from "./pilot/Pilot";
type Classroom = {
  id: string;
  name: string;
  students: { id: string; name: string }[];
};
export function Teacher() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
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
    const [s, a, rooms] = await Promise.all([
      api("/students"),
      api("/assignments"),
      api("/classrooms"),
    ]);
    setClassrooms(rooms);
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
    return (
      <Capture
        students={students}
        classrooms={classrooms}
        initial={selected}
        onBack={back}
      />
    );
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
          {Array.from(
            new Set(assignments.map((a) => a.distributionId || "individual")),
          ).map((group) => (
            <section key={group}>
              {group !== "individual" && (
                <h3>
                  {assignments.find((a) => a.distributionId === group)?.title} ·{" "}
                  {
                    classrooms.find(
                      (room) =>
                        room.id ===
                        assignments.find((a) => a.distributionId === group)
                          ?.classroomId,
                    )?.name
                  }{" "}
                  ·{" "}
                  {
                    assignments.filter(
                      (a) =>
                        a.distributionId === group &&
                        [
                          "submitted",
                          "reviewed",
                          "parent_acknowledged",
                        ].includes(a.status),
                    ).length
                  }
                  /
                  {assignments.filter((a) => a.distributionId === group).length}{" "}
                  הגישו
                </h3>
              )}
              {group === "individual" && <h3>טיוטות ומשימות אישיות</h3>}
              {assignments
                .filter((a) => (a.distributionId || "individual") === group)
                .map((a) => (
                  <article className="assignment-row" key={a.id}>
                    <div>
                      <span className="status-label">
                        {a.preparedDistributionId
                          ? "הכנה שנשלחה לכיתה"
                          : statuses[a.status]}
                      </span>
                      <h3>{a.title}</h3>
                      <p>
                        {students.find((s) => s.id === a.studentId)?.name} ·{" "}
                        {a.exercises.length} תרגילים
                      </p>
                    </div>
                    <button
                      disabled={!!a.preparedDistributionId}
                      onClick={() => {
                        setSelected(a);
                        setView(a.status === "draft" ? "create" : "review");
                      }}
                    >
                      {a.preparedDistributionId
                        ? "נשלחה לכיתה"
                        : a.status === "draft"
                          ? "המשך הכנה"
                          : a.status === "submitted"
                            ? "בדיקת העבודה"
                            : "צפייה בעבודה"}
                    </button>
                  </article>
                ))}
            </section>
          ))}
        </Panel>
        <aside>
          <ClassroomManager
            classrooms={classrooms}
            students={students}
            refresh={refresh}
          />
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
            <details>
              <summary>קישורי כניסה וניהול תלמידים ({students.length})</summary>
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
                    חידוש קישור אישי
                  </button>
                  <button
                    onClick={() =>
                      run(async () => {
                        await api(`/students/${s.id}/pairing`, "DELETE", {});
                        setPair("");
                      })
                    }
                  >
                    ביטול קישור כניסה
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
            </details>
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
                <small>
                  קישור אישי לשימוש חוזר במשך שבעה ימים. זהו תוקף הקישור לכניסה,
                  לא משך העבודה. חידוש מבטל את הקישור הקודם.
                </small>
                <button
                  type="button"
                  onClick={() => run(() => navigator.clipboard.writeText(pair))}
                >
                  העתקת הקישור
                </button>
                {typeof navigator.share === "function" && (
                  <button
                    type="button"
                    onClick={() =>
                      run(() =>
                        navigator.share({ title: "כניסה למחברת", url: pair }),
                      )
                    }
                  >
                    שיתוף הקישור
                  </button>
                )}
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

function ClassroomManager({
  classrooms,
  students,
  refresh,
}: {
  classrooms: Classroom[];
  students: { id: string; name: string }[];
  refresh: () => Promise<void>;
}) {
  const [name, setName] = useState(""),
    [selected, setSelected] = useState(""),
    [names, setNames] = useState(""),
    [consent, setConsent] = useState(false),
    [existing, setExisting] = useState("");
  const { run, busy, error } = useAction();
  const room = classrooms.find((c) => c.id === selected);
  return (
    <Panel>
      <h2>הכיתות שלי</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const c = await api("/classrooms", "POST", { name });
            setSelected(c.id);
            setName("");
            await refresh();
          });
        }}
      >
        <label>
          שם כיתה חדשה
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button disabled={busy}>יצירת כיתה</button>
      </form>
      <label>
        ניהול כיתה
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">בחירת כיתה</option>
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.students.length})
            </option>
          ))}
        </select>
      </label>
      {room && (
        <>
          <p>
            מכינים משימה אחת ובוחרים כיתה במסך ההכנה. כל תלמיד מקבל עותק אישי עם
            תשובות ומשוב משלו.
          </p>
          <details>
            <summary>תלמידי הכיתה ({room.students.length})</summary>
            {room.students.map((s) => (
              <div className="student-row" key={s.id}>
                <strong>{s.name}</strong>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api(
                        `/classrooms/${room.id}/students/${s.id}`,
                        "DELETE",
                        {},
                      );
                      await refresh();
                    })
                  }
                >
                  הסרה מהכיתה
                </button>
              </div>
            ))}
          </details>
          <small>
            הסרה מהכיתה שומרת את התלמיד ואת עבודותיו. תלמידים שיתווספו יקבלו רק
            משימות שיישלחו בהמשך.
          </small>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api(`/classrooms/${room.id}/students`, "POST", {
                  names: names
                    .split(/\r?\n/)
                    .map((n) => n.trim())
                    .filter(Boolean),
                  consent,
                });
                setNames("");
                setConsent(false);
                await refresh();
              });
            }}
          >
            <label>
              תלמידים חדשים — שם אחד בכל שורה
              <textarea
                required
                value={names}
                onChange={(e) => setNames(e.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              קיבלתי הסכמת הורה או אפוטרופוס לכל תלמיד ברשימה לשמירת העבודה
              והמשוב.
            </label>
            <button disabled={busy}>הוספת התלמידים לכיתה</button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api(`/classrooms/${room.id}/students`, "POST", {
                  studentIds: [existing],
                });
                setExisting("");
                await refresh();
              });
            }}
          >
            <label>
              צירוף תלמיד קיים
              <select
                required
                value={existing}
                onChange={(e) => setExisting(e.target.value)}
              >
                <option value="">בחירת תלמיד</option>
                {students
                  .filter((s) => !room.students.some((r) => r.id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <button disabled={busy}>צירוף לכיתה</button>
          </form>
        </>
      )}
      <ErrorMessage error={error} />
    </Panel>
  );
}

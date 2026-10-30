import { useEffect, useState } from "react";
import { api } from "../../api";
import { ErrorMessage, Panel, useAction } from "../../components/Common";
import type { Observation } from "./metrics";
export function Pilot({
  students,
  onBack,
}: {
  students: { id: string; name: string }[];
  onBack: () => void;
}) {
  const [report, setReport] = useState<any>(null),
    [form, setForm] = useState<Observation>({
      studentId: students[0]?.id ?? "",
      phase: "baseline",
      mode: "touch",
      interfaceAssists: 0,
      teachingAssists: 0,
      additionalApps: 0,
      blocked: false,
    });
  const { run, error, busy } = useAction();
  async function refresh() {
    setReport(await api("/pilot"));
  }
  useEffect(() => {
    void run(refresh);
  }, []);
  const percent = (n: number, d: number) =>
    d ? `${Math.round((n / d) * 100)}%` : "אין נתונים";
  return (
    <>
      <button onClick={onBack}>→ חזרה למשימות</button>
      <h1>לומדים מהפיילוט</h1>
      <p>
        השוואה לכל תלמיד מול עצמו ובאותה דרך הפעלה. עזרה בהפעלת הממשק נמדדת
        בנפרד מעזרה בלמידה.
      </p>
      <div className="teacher-layout">
        <Panel>
          <h2>תיעוד מפגש קצר</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api("/pilot/observations", "POST", form);
                await refresh();
              });
            }}
          >
            <label>
              תלמיד
              <select
                value={form.studentId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, studentId: e.target.value }))
                }
              >
                {students.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              שלב
              <select
                value={form.phase}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    phase: e.target.value as Observation["phase"],
                  }))
                }
              >
                <option value="baseline">קו בסיס — הכלים הקיימים</option>
                <option value="machberet">עבודה במחברת+</option>
              </select>
            </label>
            <label>
              דרך ההפעלה
              <select
                value={form.mode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mode: e.target.value }))
                }
              >
                <option value="touch">מגע</option>
                <option value="keyboard">מקלדת</option>
                <option value="gaze">מיקוד מבט</option>
                <option value="switch">מתגים</option>
              </select>
            </label>
            {(
              [
                ["interfaceAssists", "עזרות להפעלת הממשק"],
                ["teachingAssists", "עזרות בלמידה"],
                ["additionalApps", "אפליקציות נוספות לדף העבודה"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                  }
                />
              </label>
            ))}
            <p className="muted">אין לספור כלי קלט מסייעים כאפליקציה נוספת.</p>
            <label>
              זמן צילום עד משימה מאושרת (שניות, רשות)
              <input
                type="number"
                min="0"
                value={
                  form.preparationMs === undefined
                    ? ""
                    : form.preparationMs / 1000
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    preparationMs:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value) * 1000,
                  }))
                }
              />
            </label>
            <label>
              זמן סימון תרגיל, ללא קריאה והקלטה (שניות, רשות)
              <input
                type="number"
                min="0"
                value={
                  form.markingMs === undefined ? "" : form.markingMs / 1000
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    markingMs:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value) * 1000,
                  }))
                }
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={form.blocked}
                onChange={(e) =>
                  setForm((f) => ({ ...f, blocked: e.target.checked }))
                }
              />
              תקלה טכנית מנעה השלמת מפגש
            </label>
            <button className="primary" disabled={busy || !form.studentId}>
              שמירת התצפית
            </button>
          </form>
        </Panel>
        {report && (
          <Panel>
            <h2>מה אנחנו רואים?</h2>
            <dl>
              <dt>משימות שהגיעו לבדיקה (יעד 80%)</dt>
              <dd>
                {percent(report.workflow.reviewed, report.workflow.assigned)}
              </dd>
              <dt>מפגשים ללא אפליקציה נוספת (יעד 90%)</dt>
              <dd>
                {report.summary.appFreePercent === null
                  ? "אין נתונים"
                  : `${Math.round(report.summary.appFreePercent)}%`}
              </dd>
              <dt>חציון הכנה (יעד 180 שניות)</dt>
              <dd>
                {report.summary.preparationMedianMs === null
                  ? "אין נתונים"
                  : `${report.summary.preparationMedianMs / 1000} שניות`}
              </dd>
              <dt>חציון סימון (יעד 10 שניות)</dt>
              <dd>
                {report.summary.markingMedianMs === null
                  ? "אין נתונים"
                  : `${report.summary.markingMedianMs / 1000} שניות`}
              </dd>
              <dt>אישור הורה בתוך 48 שעות (יעד 70%)</dt>
              <dd>
                {percent(report.parents.within48h, report.parents.eligible)} ·{" "}
                {report.parents.pendingWindow} עדיין בחלון המענה
              </dd>
              <dt>מפגשים עם חסם טכני</dt>
              <dd>{report.summary.blockedSessions}</dd>
            </dl>
            <h3>שינוי בעזרה להפעלה (יעד ירידה של 30%)</h3>
            {report.summary.independence.map((r: any) => (
              <p key={`${r.studentId}-${r.mode}`}>
                {students.find((s) => s.id === r.studentId)?.name ?? "תלמיד"} ·{" "}
                {r.mode}:{" "}
                {r.reduction === null
                  ? "נדרש קו בסיס מתאים"
                  : `${Math.round(r.reduction)}% ירידה`}
              </p>
            ))}
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(report, null, 2)], {
                  type: "application/json",
                });
                const u = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = u;
                a.download = "machberet-pilot-report.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(u), 1000);
              }}
            >
              הורדת נתוני הפיילוט
            </button>
            <p className="muted">
              הדוח כולל מזהים פנימיים ותצפיות שהוזנו בלבד. אין הקלטת פעילות
              ברקע.
            </p>
          </Panel>
        )}
      </div>
      <ErrorMessage error={error} />
    </>
  );
}

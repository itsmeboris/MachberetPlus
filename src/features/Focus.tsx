import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api";

type FocusState = {
  active: boolean;
  requestId: string | null;
  expiresAt: number;
  serverNow: number;
  acknowledgedAt: number | null;
  endedBy: string | null;
};
type FocusStudent = FocusState & { id: string; name: string };

function rememberedDismissals(key: string): Set<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return new Set(
      Array.isArray(saved)
        ? saved.filter((id): id is string => typeof id === "string").slice(-20)
        : [],
    );
  } catch {
    return new Set();
  }
}

export function StudentFocus({ userId }: { userId: string }) {
  const storageKey = `machberet-focus-dismissed:${userId}`;
  const [active, setActive] = useState<string | null>(null);
  const dismissed = useRef(rememberedDismissals(storageKey));
  useEffect(() => {
    let disposed = false,
      busy = false,
      deadline = 0,
      current: string | null = null;
    const acknowledged = new Set<string>();
    const refresh = async () => {
      if (busy || document.hidden || disposed) return;
      busy = true;
      const started = performance.now();
      try {
        const state = await api<FocusState>("/focus");
        if (disposed) return;
        const remaining =
          Math.min(600000, state.expiresAt - state.serverNow) -
          (performance.now() - started);
        if (
          !state.active ||
          !state.requestId ||
          dismissed.current.has(state.requestId) ||
          remaining <= 0
        ) {
          current = null;
          setActive(null);
          if (
            state.active &&
            state.requestId &&
            dismissed.current.has(state.requestId)
          ) {
            await api("/focus/dismiss", "POST", { requestId: state.requestId });
          }
        } else {
          current = state.requestId;
          deadline = performance.now() + remaining;
          setActive(current);
          if (!acknowledged.has(current)) {
            const id = current;
            await api("/focus/ack", "POST", { requestId: id });
            acknowledged.add(id);
          }
        }
      } catch {
        /* A local deadline still ends focus when disconnected. */
      } finally {
        busy = false;
      }
    };
    const expire = () => {
      if (current && performance.now() >= deadline) {
        current = null;
        setActive(null);
      }
    };
    const resume = () => {
      expire();
      void refresh();
    };
    void refresh();
    const poll = window.setInterval(refresh, 5000);
    const timer = window.setInterval(expire, 250);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      clearInterval(poll);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, []);
  useEffect(() => {
    if (active) document.documentElement.dataset.teacherFocus = "true";
    else delete document.documentElement.dataset.teacherFocus;
    return () => {
      delete document.documentElement.dataset.teacherFocus;
    };
  }, [active]);
  if (!active) return null;
  return (
    <>
      <aside className="teacher-focus-banner" aria-label="מיקוד בשאלה">
        <span role="status">
          המורה הפעיל מיקוד · השאלה והתשובה נשארות מוארות. המיקוד יסתיים
          אוטומטית.
        </span>
        <button
          onClick={() => {
            dismissed.current.add(active);
            try {
              localStorage.setItem(
                storageKey,
                JSON.stringify([...dismissed.current].slice(-20)),
              );
            } catch {
              /* Dismissal still works in memory when storage is unavailable. */
            }
            setActive(null);
            void api("/focus/dismiss", "POST", { requestId: active }).catch(
              () => {},
            );
          }}
        >
          סיום המיקוד
        </button>
      </aside>
      {createPortal(
        <div className="teacher-focus-mask" aria-hidden="true" />,
        document.body,
      )}
    </>
  );
}

export function ClassroomFocus({ classroomId }: { classroomId: string }) {
  const [rows, setRows] = useState<FocusStudent[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => {
    let disposed = false,
      fetching = false;
    setRows([]);
    setError("");
    const refresh = async () => {
      if (disposed || fetching || document.hidden) return;
      fetching = true;
      const version = generation.current;
      try {
        const next = await api<FocusStudent[]>(
          `/focus/classrooms/${classroomId}`,
        );
        if (!disposed && version === generation.current) {
          setRows(next);
          setError("");
        }
      } catch {
        if (!disposed)
          setError(
            "לא ניתן לעדכן את מצב המיקוד. המצב המוצג עשוי להיות לא מעודכן.",
          );
      } finally {
        fetching = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [classroomId]);
  return (
    <section className="classroom-focus" aria-label="מיקוד אישי לתלמידים">
      <h3>מיקוד בשאלה ובתשובה</h3>
      <p>
        מעמעמים את הרקע במחברת למשך 5 דקות עבור תלמיד אחד. התלמיד יכול לסיים בכל
        רגע. אין מעקב אחר קשב או מבט.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows.map((row) => (
        <div className="student-row" key={row.id}>
          <strong>
            <bdi>{row.name}</bdi>
          </strong>
          <span>
            {row.active
              ? row.acknowledgedAt
                ? "בקשת המיקוד התקבלה במכשיר"
                : "ממתינים לקבלה במכשיר"
              : row.endedBy === "student"
                ? "התלמיד סיים את המיקוד"
                : row.requestId
                  ? "המיקוד הסתיים"
                  : "מיקוד לא פעיל"}
          </span>
          <button
            disabled={busy !== null}
            aria-label={`${row.active ? "סיום" : "הפעלת"} מיקוד עבור ${row.name}`}
            onClick={async () => {
              setBusy(row.id);
              generation.current++;
              try {
                const next = await api<FocusState>(
                  `/focus/students/${row.id}`,
                  "PUT",
                  { active: !row.active },
                );
                generation.current++;
                setRows((previous) =>
                  previous.map((r) =>
                    r.id === row.id ? { ...r, ...next } : r,
                  ),
                );
                setError("");
              } catch {
                setError("לא ניתן לשנות את המיקוד. נסו שוב.");
              } finally {
                setBusy(null);
              }
            }}
          >
            {row.active ? "סיום המיקוד" : "מיקוד ל־5 דקות"}
          </button>
        </div>
      ))}
    </section>
  );
}

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useId,
  useState,
  type ReactNode,
} from "react";
import { api } from "../api";
import type { Preferences, User } from "../types";
import { ErrorMessage, Panel, useAction } from "../components/Common";
import { DwellActivation, mathSpeech } from "./interaction";
const defaults: Preferences = {
  mode: "standard",
  dwellMs: 1000,
  dwellSource: "off",
  spotlight: true,
  fontScale: 1,
  switchNext: "Space",
  switchSelect: "Enter",
};
const AccessContext = createContext(defaults);
export const usePreferences = () => useContext(AccessContext);
export function speakHebrew(text: string) {
  if (!window.speechSynthesis)
    throw new Error("הדפדפן אינו תומך בהקראה. אפשר להאזין להקלטת המורה.");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(mathSpeech(text));
  utterance.lang = "he-IL";
  const voice = speechSynthesis
    .getVoices()
    .find((v) => v.lang.startsWith("he"));
  if (voice) utterance.voice = voice;
  utterance.rate = 0.85;
  speechSynthesis.speak(utterance);
}
export function Access({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState<Preferences>({
      ...defaults,
      ...user.preferences,
    }),
    [settings, setSettings] = useState(false),
    [paused, setPaused] = useState(false),
    [scanLabel, setScanLabel] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const settingsId = useId();
  const { run, error, busy } = useAction();
  useEffect(() => {
    void api<Preferences>("/preferences")
      .then((saved) => setPreferences({ ...defaults, ...saved }))
      .catch(() => {});
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--target",
      preferences.mode === "standard" ? "64px" : "88px",
    );
    return () => document.documentElement.style.setProperty("--target", "64px");
  }, [preferences.mode]);
  useEffect(() => {
    if (preferences.dwellSource !== "app" || !root.current) return;
    const region = root.current;
    const dwell = new DwellActivation(preferences.dwellMs);
    let target: HTMLElement | null = null,
      raf = 0,
      sequence = 0;
    let dispatching = false;
    let lastPointerType = "";
    const clear = () => {
      target?.classList.remove("dwell-target");
      target?.style.removeProperty("--dwell-progress");
      target = null;
      dwell.reset();
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const next = (event.target as Element).closest<HTMLElement>(
        "button:not(:disabled),a,input,textarea,select",
      );
      if (next !== target) {
        clear();
        if (
          next &&
          region.contains(next) &&
          (!paused || next.hasAttribute("data-resume"))
        ) {
          target = next;
          target.dataset.dwellId = String(++sequence);
        }
      }
    };
    const pointerDown = (event: PointerEvent) => {
      lastPointerType = event.pointerType;
      if (event.pointerType === "touch") clear();
    };
    const click = (event: MouseEvent) => {
      // Touch is direct activation, even when an external pointer uses dwell.
      const pointerType =
        (event as PointerEvent).pointerType || lastPointerType;
      if (pointerType === "touch") return;
      if (!paused && !dispatching && event.isTrusted && event.detail > 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const tick = (now: number) => {
      if (target && !target.isConnected) clear();
      if (target) {
        const state = dwell.update(target.dataset.dwellId!, now);
        target.classList.add("dwell-target");
        target.style.setProperty(
          "--dwell-progress",
          `${state.progress * 100}%`,
        );
        if (state.activate) {
          dispatching = true;
          if (target.matches("input,textarea,select")) target.focus();
          else target.click();
          dispatching = false;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    region.addEventListener("pointerover", move);
    region.addEventListener("pointerdown", pointerDown);
    region.addEventListener("pointerleave", clear);
    region.addEventListener("click", click, true);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clear();
      region.removeEventListener("pointerover", move);
      region.removeEventListener("pointerdown", pointerDown);
      region.removeEventListener("pointerleave", clear);
      region.removeEventListener("click", click, true);
    };
  }, [preferences.dwellSource, preferences.dwellMs, paused]);
  useEffect(() => {
    if (preferences.mode !== "switch" || paused || !root.current) return;
    const region = root.current;
    let groupIndex = -1,
      itemIndex = -1,
      active: HTMLElement | null = null;
    function groups() {
      const targets = Array.from(
        region.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a,input:not([type=hidden]),textarea,select",
        ),
      ).filter((e) => e.getClientRects().length && !e.closest("[hidden]"));
      const result: HTMLElement[][] = [];
      const seen = new Set<Element>();
      for (const t of targets) {
        const row = t.closest("[data-scan-group]");
        if (row) {
          if (seen.has(row)) continue;
          seen.add(row);
          result.push(
            targets.filter((x) => x.closest("[data-scan-group]") === row),
          );
        } else result.push([t]);
      }
      return result;
    }
    function mark(target: HTMLElement, group: boolean) {
      active?.classList.remove("switch-target");
      active = group
        ? (target.closest<HTMLElement>("[data-scan-group]") ?? target)
        : target;
      active.classList.add("switch-target");
      target.setAttribute("data-scan-preview", "");
      target.focus({ preventScroll: true });
      target.removeAttribute("data-scan-preview");
      active.scrollIntoView({ block: "nearest" });
      setScanLabel(group ? "בחירת קבוצת מקשים" : "בחירת פעולה");
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (
        event.code !== preferences.switchNext &&
        event.code !== preferences.switchSelect &&
        event.code !== "Escape"
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      const list = groups();
      if (!list.length) return;
      if (event.code === "Escape") {
        itemIndex = -1;
        return;
      }
      if (event.code === preferences.switchNext) {
        if (itemIndex < 0) {
          groupIndex = (groupIndex + 1) % list.length;
          mark(list[groupIndex][0], list[groupIndex].length > 1);
        } else {
          itemIndex = (itemIndex + 1) % list[groupIndex].length;
          mark(list[groupIndex][itemIndex], false);
        }
        return;
      }
      if (groupIndex < 0 || groupIndex >= list.length) groupIndex = 0;
      const group = list[groupIndex];
      if (group.length > 1 && itemIndex < 0) {
        itemIndex = 0;
        mark(group[0], false);
      } else {
        const el = group[Math.max(0, itemIndex)];
        el.focus();
        el.click();
        itemIndex = -1;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      active?.classList.remove("switch-target");
    };
  }, [
    preferences.mode,
    preferences.switchNext,
    preferences.switchSelect,
    paused,
  ]);
  return (
    <AccessContext.Provider value={preferences}>
      <div
        ref={root}
        className="access-root"
        data-access-mode={preferences.mode}
        style={{ fontSize: `${preferences.fontScale}em` }}
      >
        <div className="access-toolbar">
          <button
            ref={settingsButton}
            onClick={() => setSettings(!settings)}
            aria-expanded={settings}
            aria-controls={settingsId}
          >
            התאמות אישיות
          </button>
          {(preferences.dwellSource === "app" ||
            preferences.mode === "switch") && (
            <button
              data-resume
              onClick={() => setPaused(!paused)}
              aria-pressed={paused}
            >
              {paused ? "המשך הפעלה" : "השהיית הפעלה"}
            </button>
          )}
          <span className="muted" aria-live="polite">
            {preferences.mode === "switch" ? scanLabel : ""}
          </span>
        </div>
        <div id={settingsId} hidden={!settings}>
          {settings && (
            <Panel className="access-settings">
              <h2>איך נוח לי ללמוד?</h2>
              <label>
                דרך ההפעלה
                <select
                  aria-label="דרך ההפעלה"
                  value={preferences.mode}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      mode: e.target.value as Preferences["mode"],
                    }))
                  }
                >
                  <option value="standard">מגע, עכבר ומקלדת</option>
                  <option value="motor">כפתורים גדולים</option>
                  <option value="gaze">מצביע עיניים חיצוני</option>
                  <option value="switch">שני מתגים</option>
                </select>
              </label>
              <p className="muted" aria-live="polite">
                {preferences.mode === "standard" &&
                  "מקלדת חשבון קומפקטית למגע, לעכבר ולמקלדת רגילה."}
                {preferences.mode === "motor" &&
                  "כפתורים גדולים בגודל 88 פיקסלים לפחות, לתנועה וללחיצה נוחות יותר."}
                {preferences.mode === "gaze" &&
                  "כפתורים גדולים לשימוש עם מצביע עיניים חיצוני שמזיז את סמן העכבר. המחברת אינה מפעילה מצלמה ואינה עוקבת אחרי העיניים. בוחרים בנפרד מי מפעיל לחיצה בשהייה."}
                {preferences.mode === "switch" &&
                  "כפתורים גדולים וסריקה באמצעות שני מתגים: רווח לקידום ו־Enter לבחירה."}
              </p>
              <label>
                הפעלה בשהייה
                <select
                  aria-label="הפעלה בשהייה"
                  value={preferences.dwellSource}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      dwellSource: e.target.value as Preferences["dwellSource"],
                    }))
                  }
                >
                  <option value="off">כבויה</option>
                  <option value="app">המחברת מפעילה בשהייה</option>
                  <option value="device">המכשיר מפעיל בשהייה</option>
                </select>
              </label>
              <p className="muted">
                שהייה פועלת בנפרד מדרך ההפעלה. במצב ״המחברת״, השארת הסמן על
                כפתור מפעילה אותו ללא לחיצה. כשמפעילים שהייה במכשיר, בוחרים כאן
                ״המכשיר״ כדי למנוע הפעלה כפולה. במצב ״כבויה״ לוחצים כרגיל.
              </p>
              {preferences.dwellSource === "app" && (
                <label>
                  זמן שהייה: {preferences.dwellMs} מילישניות
                  <input
                    type="range"
                    min="800"
                    max="1500"
                    step="100"
                    value={preferences.dwellMs}
                    onChange={(e) =>
                      setPreferences((p) => ({
                        ...p,
                        dwellMs: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={preferences.spotlight}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      spotlight: e.target.checked,
                    }))
                  }
                />
                מיקוד בשאלה הפעילה
              </label>
              <p className="muted">
                מיקוד בשאלה מוסיף מסגרת ברורה סביב התרגיל. הניווט והעזרה נשארים
                גלויים וקריאים. הוא אינו מעקב עיניים ואינו משנה את דרך ההפעלה.
              </p>
              <label>
                גודל טקסט
                <select
                  value={preferences.fontScale}
                  onChange={(e) =>
                    setPreferences((p) => ({
                      ...p,
                      fontScale: Number(e.target.value),
                    }))
                  }
                >
                  <option value="1">רגיל</option>
                  <option value="1.25">גדול</option>
                  <option value="1.5">גדול מאוד</option>
                </select>
              </label>
              {preferences.mode === "switch" && (
                <p>
                  שני מתגים: רווח לקידום, Enter לבחירה. במקלדת בוחרים קודם שורת
                  מקשים ואז מקש. Escape חוזר לקבוצות.
                </p>
              )}
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    setPreferences(
                      await api("/preferences", "PUT", preferences),
                    );
                    setSettings(false);
                    settingsButton.current?.focus();
                  })
                }
              >
                שמירת ההתאמות
              </button>
              <ErrorMessage error={error} />
            </Panel>
          )}
        </div>
        {children}
      </div>
    </AccessContext.Provider>
  );
}

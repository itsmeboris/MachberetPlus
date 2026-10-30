import { useState } from "react";
import { api } from "../api";
import type { User } from "../types";
import { ErrorMessage, Panel, useAction } from "../components/Common";
export function Auth({ onLogin }: { onLogin: (u: User) => void }) {
  const code = new URLSearchParams(location.search).get("join");
  const [register, setRegister] = useState(false),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [name, setName] = useState(""),
    [consent, setConsent] = useState(false);
  const { run, busy, error } = useAction();
  return (
    <div className="welcome">
      <div className="welcome-copy">
        <p className="eyebrow">מחברת אחת. בקצב שלך.</p>
        <h1>
          מקום שקט
          <br />
          ללמוד ולהצליח.
        </h1>
        <p>מהדף בכיתה ועד לחיוך בבית — המשימות, הפתרונות והמשוב נפגשים כאן.</p>
        <div className="notebook-mark" aria-hidden="true">
          א ב ג <span dir="ltr">1 + 2</span>
        </div>
      </div>
      <Panel>
        <p className="eyebrow">ברוכים הבאים למחברת+</p>
        <h2>
          {code
            ? "המשימות שלך מחכות לך"
            : register
              ? "נעים להכיר"
              : "טוב שחזרתם"}
        </h2>
        {code ? (
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api("/auth/student", "POST", { code });
                history.replaceState({}, "", "/");
                onLogin(await api("/auth/me"));
              })
            }
          >
            כניסה למשימות שלי
          </button>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () =>
                  onLogin(
                    await api(
                      `/auth/${register ? "register" : "login"}`,
                      "POST",
                      { email, password, name, consent },
                    ),
                  ),
                );
              }}
            >
              {register && (
                <label>
                  שם
                  <input
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              <label>
                דואר אלקטרוני
                <input
                  required
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  aria-describedby="email-help"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <p id="email-help" className="muted">
                אפשר להשתמש בכל כתובת דואר אלקטרוני. הסיסמה היא לחשבון במחברת+.
              </p>
              {register && (
                <p id="password-help" className="muted">
                  בחרו סיסמה באורך 12 תווים לפחות, למשל משפט שקל לזכור.
                </p>
              )}
              <label>
                סיסמה
                <input
                  required
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  aria-describedby={register ? "password-help" : undefined}
                  dir="ltr"
                  autoComplete={register ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button
                type="button"
                aria-controls="auth-password"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "הסתרת סיסמה" : "הצגת סיסמה"}
              </button>
              {register && (
                <label className="check">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  אני מסכימ/ה לשמירת החשבון והעבודה לצורך הפיילוט. אפשר למחוק את
                  הנתונים בכל עת.
                </label>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? "רק רגע…"
                  : register
                    ? "יצירת החשבון"
                    : "כניסה למרחב שלי"}
              </button>
            </form>
            <button onClick={() => setRegister(!register)}>
              {register ? "כבר יש לי חשבון" : "יצירת חשבון מורה"}
            </button>
          </>
        )}
        <ErrorMessage error={error} />
        <p className="muted">לתלמידים: נכנסים דרך הקישור האישי מהמורה.</p>
      </Panel>
    </div>
  );
}

import { useEffect, useState } from "react";
import { api } from "./api";
import type { User } from "./types";
import { Auth } from "./features/Auth";
import { Teacher } from "./features/Teacher";
import { Student } from "./features/student/Student";
import { Parent } from "./features/parent/Parent";
import { Access } from "./accessibility/Access";
import { ParentCapture } from "./features/parent/ParentCapture";
export function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  const parentToken = location.pathname.startsWith("/p/")
    ? location.pathname.slice(3)
    : null;
  const captureToken = location.pathname.startsWith("/c/")
    ? location.pathname.slice(3)
    : null;
  useEffect(() => {
    if (parentToken || captureToken) {
      setLoading(false);
      return;
    }
    api<User>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
      <a className="skip-link" href="#main-content">
        דילוג לתוכן הראשי
      </a>
      <header className="topbar">
        <a href="/" className="brand" aria-label="מחברת פלוס">
          <span className="brand-icon" aria-hidden="true">
            ▤
          </span>
          מחברת<span className="brand-plus">+</span>
        </a>
        <span className="tagline">לומדים בקצב שלך</span>
        {user && (
          <div className="user-menu">
            <span>
              שלום, <bdi>{user.name}</bdi>
            </span>
            <button
              onClick={async () => {
                await api("/auth/logout", "POST", {});
                setUser(null);
              }}
            >
              יציאה
            </button>
          </div>
        )}
      </header>
      <main id="main-content" tabIndex={-1}>
        {loading ? (
          <p role="status">טוענים את המחברת…</p>
        ) : captureToken ? (
          <ParentCapture token={captureToken} />
        ) : parentToken ? (
          <Parent token={parentToken} />
        ) : !user ? (
          <Auth onLogin={setUser} />
        ) : user.role === "teacher" ? (
          <Teacher />
        ) : (
          <Access user={user}>
            <Student user={user} />
          </Access>
        )}
      </main>
      <footer>מחברת+ · לומדים, משתפים, צומחים יחד</footer>
    </>
  );
}

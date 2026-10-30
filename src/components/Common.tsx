import { useState, type ReactNode } from "react";
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <p className="error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}
export function useAction() {
  const [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  async function run(work: () => Promise<unknown>) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await work();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return { error, busy, run };
}
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Audio({
  id,
  parentToken,
}: {
  id?: string | null;
  parentToken?: string;
}) {
  return id ? (
    <audio
      controls
      preload="none"
      src={
        parentToken
          ? `/api/parent/${parentToken}/media/${id}`
          : `/api/media/${id}`
      }
      aria-label="האזנה להקלטה"
    />
  ) : null;
}

import { useEffect, useState } from "react";
import { api } from "../../api";
import type { Assignment } from "../../types";
import { ErrorMessage, Panel, useAction } from "../../components/Common";
import { WorkRecord } from "../review/WorkRecord";
export function Parent({ token }: { token: string }) {
  const [a, setA] = useState<Assignment | null>(null),
    [ack, setAck] = useState(false);
  const { run, busy, error } = useAction();
  useEffect(() => {
    void run(async () => {
      const result = await api<Assignment>(`/parent/${token}`);
      setA(result);
      setAck(!!result.acknowledgedAt);
    });
  }, [token]);
  return (
    <div className="parent-view">
      <p className="eyebrow">רגע קטן של גאווה, ביחד</p>
      <h1>מסתכלים על הדרך שעשינו</h1>
      <p>העבודה והמשוב מהמורה, במקום אחד.</p>
      <ErrorMessage error={error} />
      {!a && !error && <p role="status">טוענים את העבודה והמשוב…</p>}
      {a && (
        <>
          <WorkRecord assignment={a} parentToken={token} headingLevel={2} />
          <Panel>
            {ack ? (
              <div role="status">
                <h2>האישור נשמר. תודה!</h2>
              </div>
            ) : (
              <>
                <h2>עברתם על העבודה יחד?</h2>
                <p>לחיצה תעדכן את המורה. אין צורך לפתוח חשבון.</p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api(`/parent/${token}/acknowledge`, "POST", {});
                      setAck(true);
                    })
                  }
                >
                  עברנו יחד על הדף
                </button>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

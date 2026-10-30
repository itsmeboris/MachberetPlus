import type { Assignment } from "../../types";
import { statuses } from "../../types";
import { Audio, Panel, ErrorMessage, useAction } from "../../components/Common";
import { downloadRecord } from "./export";
import { MathText } from "../../components/MathText";
import { AnswerView } from "../../components/AnswerView";
import { decisionLabel } from "./decisions";
export function WorkRecord({
  assignment: a,
  parentToken,
}: {
  assignment: Assignment;
  parentToken?: string;
}) {
  const { run, error, busy } = useAction();
  return (
    <Panel className="work-record">
      <p className="eyebrow">{statuses[a.status]}</p>
      <h1>{a.title}</h1>
      <Audio id={a.instructionsId} parentToken={parentToken} />
      {a.exercises.map((q, i) => (
        <article className="record-question" key={q.id}>
          <h2>
            {i + 1}. {q.prompt}
          </h2>
          {q.math && (
            <p className="math" dir="ltr">
              <MathText value={q.math} />
            </p>
          )}
          <AnswerView question={q} answer={a.answers[q.id]} />
          <p className="teacher-decision">
            סימון המורה:{" "}
            <strong>{decisionLabel(a.feedback[q.id]?.decision)}</strong>
          </p>
          {a.feedback[q.id] && (
            <div className="feedback-note">
              {a.feedback[q.id].sticker && (
                <span aria-label="מדבקה מהמורה">
                  {a.feedback[q.id].sticker === "heart" ? "♡" : "☆"}
                </span>
              )}
              <p>{a.feedback[q.id].text}</p>
              <Audio id={a.feedback[q.id].audioId} parentToken={parentToken} />
            </div>
          )}
        </article>
      ))}
      <button className="no-print" onClick={() => window.print()}>
        הדפסה / שמירה כ־PDF
      </button>
      <button
        className="no-print"
        disabled={busy}
        onClick={() => run(() => downloadRecord(a, parentToken))}
      >
        הורדת העבודה והמשוב
      </button>
      <ErrorMessage error={error} />
    </Panel>
  );
}

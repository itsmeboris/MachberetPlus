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
  headingLevel = 1,
}: {
  assignment: Assignment;
  parentToken?: string;
  headingLevel?: 1 | 2;
}) {
  const { run, error, busy } = useAction();
  const Title = headingLevel === 1 ? "h1" : "h2";
  const QuestionTitle = headingLevel === 1 ? "h2" : "h3";
  return (
    <Panel className="work-record">
      <p className="status-label">{statuses[a.status]}</p>
      <Title>
        <bdi>{a.title}</bdi>
      </Title>
      <Audio id={a.instructionsId} parentToken={parentToken} />
      {a.exercises.map((q, i) => (
        <article className="record-question" key={q.id}>
          <QuestionTitle>
            תרגיל {i + 1}
            {q.prompt && (
              <>
                {" "}
                · <bdi>{q.prompt}</bdi>
              </>
            )}
          </QuestionTitle>
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
                <span
                  role="img"
                  aria-label={
                    a.feedback[q.id].sticker === "heart"
                      ? "גאים בך"
                      : a.feedback[q.id].sticker === "effort"
                        ? "רואים את המאמץ"
                        : "כל הכבוד"
                  }
                >
                  {a.feedback[q.id].sticker === "heart" ? "♡" : "☆"}
                </span>
              )}
              <p dir="auto">{a.feedback[q.id].text}</p>
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

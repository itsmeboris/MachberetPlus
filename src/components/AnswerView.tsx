import type { Answer, Exercise } from "../types";
export function AnswerView({
  question: q,
  answer,
}: {
  question: Exercise;
  answer?: Answer;
}) {
  if (q.kind !== "vertical")
    return (
      <div className="answer-display" dir={q.kind === "text" ? "rtl" : "ltr"}>
        {answer?.text || "לא נכתבה תשובה"}
      </div>
    );
  const operands = q.operands ??
    q.math.match(/\d+/g)?.slice(0, 2) ?? ["0", "0"];
  const count = Math.min(7, Math.max(2, ...operands.map((n) => n.length)) + 1);
  const cells = answer?.cells ?? {};
  return (
    <div className="vertical-scroll">
      <table className="vertical-record" dir="ltr">
        <caption>דרך הפתרון במאונך</caption>
        <tbody>
          <tr>
            {Array.from({ length: count }, (_, i) => (
              <td key={i} aria-label={`המרה או שארית בעמודה ${count - i}`}>
                {cells[`carry-${i}`] ?? ""}
              </td>
            ))}
          </tr>
          {operands.map((n, row) => (
            <tr key={row}>
              {Array.from(n.padStart(count, " ")).map((digit, i) => (
                <td key={i}>
                  {i === 0 && row === 1
                    ? (q.math.match(/[+\-−×*]/)?.[0] ?? "+")
                    : digit}
                </td>
              ))}
            </tr>
          ))}
          <tr className="sum-row">
            {Array.from({ length: count }, (_, i) => (
              <td key={i} aria-label={`תשובה בעמודה ${count - i}`}>
                {cells[`answer-${i}`] ?? ""}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

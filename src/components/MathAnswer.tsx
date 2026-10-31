import type { Answer, Exercise } from "../types";
export function MathAnswer({
  exercise: q,
  answer,
  onChange,
  onFocus,
}: {
  exercise: Exercise;
  answer: Answer;
  onChange: (answer: Answer) => void;
  onFocus: (cell?: string) => void;
}) {
  if (q.kind !== "vertical")
    return (
      <label>
        התשובה שלי
        <textarea
          aria-label="התשובה שלי"
          dir={q.kind === "text" ? "rtl" : "ltr"}
          rows={q.kind === "text" ? 3 : 2}
          inputMode="text"
          value={answer.text}
          onFocus={() => onFocus()}
          onChange={(e) => onChange({ ...answer, text: e.target.value })}
          placeholder={q.kind === "text" ? "כאן אפשר לכתוב…" : "0.5"}
        />
      </label>
    );
  const operands = q.operands ??
    q.math.match(/\d+/g)?.slice(0, 2) ?? ["0", "0"];
  const count = Math.min(7, Math.max(2, ...operands.map((n) => n.length)) + 1);
  const operator = q.math.match(/[+\-−×*]/)?.[0] ?? "+";
  const cells = answer.cells ?? {};
  function cell(key: string, label: string) {
    return (
      <input
        key={key}
        aria-label={label}
        inputMode="numeric"
        maxLength={2}
        value={cells[key] ?? ""}
        onFocus={(e) => {
          if (!e.currentTarget.hasAttribute("data-scan-preview")) onFocus(key);
        }}
        onClick={() => onFocus(key)}
        onChange={(e) => {
          const next = { ...cells, [key]: e.target.value };
          onChange({
            text: Array.from(
              { length: count },
              (_, i) => next[`answer-${i}`] ?? "",
            ).join(""),
            cells: next,
          });
        }}
      />
    );
  }
  return (
    <fieldset className="vertical-answer">
      <legend>התשובה שלי — מתחילים באחדות בצד ימין</legend>
      <div className="vertical-scroll">
        <div
          className="vertical-grid"
          dir="ltr"
          style={{ gridTemplateColumns: `repeat(${count},var(--target))` }}
        >
          {Array.from({ length: count }, (_, i) =>
            cell(`carry-${i}`, `המרה או שארית בעמודה ${count - i}`),
          )}
          {operands.map((n, row) =>
            Array.from(n.padStart(count, " ")).map((digit, i) => (
              <span key={`${row}-${i}`} className="vertical-digit">
                {i === 0 && row === 1 ? operator : digit}
              </span>
            )),
          )}
          {Array.from({ length: count }, (_, i) =>
            cell(`answer-${i}`, `תשובה בעמודה ${count - i}`),
          )}
        </div>
      </div>
    </fieldset>
  );
}

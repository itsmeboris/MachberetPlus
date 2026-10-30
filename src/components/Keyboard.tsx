import { useId, useState } from "react";

const symbols = [
  ["+", "חיבור"],
  ["-", "חיסור"],
  ["×", "כפל"],
  ["÷", "חילוק"],
  ["=", "שווה"],
  ["/", "קו שבר"],
  ["x", "משתנה x"],
  ["(", "פתיחת סוגריים"],
  [")", "סגירת סוגריים"],
];

export function Keyboard({
  text,
  onKey,
}: {
  text: boolean;
  onKey: (key: string) => void;
}) {
  const [more, setMore] = useState(false);
  const symbolsId = useId();
  const chars = text ? "אבגדהוזחטיכלמנסעפצקרשתךםןףץ" : "123456789";
  const rows = Array.from({ length: Math.ceil(chars.length / 3) }, (_, i) =>
    chars.slice(i * 3, i * 3 + 3).split(""),
  );
  return (
    <div
      className="keyboard-groups"
      dir="ltr"
      aria-label={text ? "מקלדת עברית" : "מקלדת חשבון"}
    >
      {rows.map((row, i) => (
        <div
          className="keyboard-row"
          data-scan-group
          key={i}
          aria-label={
            text
              ? `קבוצת אותיות ${i + 1}`
              : `ספרות ${i * 3 + 1} עד ${i * 3 + 3}`
          }
        >
          {row.map((char) => (
            <button type="button" key={char} onClick={() => onKey(char)}>
              {char}
            </button>
          ))}
        </div>
      ))}
      <div
        className="keyboard-row"
        data-scan-group
        aria-label={text ? "עריכה" : "אפס נקודה ומחיקה"}
      >
        {!text && (
          <button type="button" onClick={() => onKey("0")}>
            0
          </button>
        )}
        {!text && (
          <button
            type="button"
            aria-label="נקודה עשרונית"
            onClick={() => onKey(".")}
          >
            .
          </button>
        )}
        <button type="button" onClick={() => onKey("delete")}>
          מחיקה
        </button>
        {text && (
          <button type="button" onClick={() => onKey(" ")}>
            רווח
          </button>
        )}
      </div>
      {!text && (
        <>
          <button
            type="button"
            className="keyboard-symbol-toggle"
            aria-expanded={more}
            aria-controls={symbolsId}
            onClick={() => setMore(!more)}
          >
            {more ? "הסתרת סימנים" : "סימנים ופעולות + − × ÷"}
          </button>
          <div id={symbolsId} hidden={!more} className="keyboard-symbols">
            {[0, 3, 6].map((start) => (
              <div
                key={start}
                className="keyboard-row"
                data-scan-group
                aria-label={`קבוצת סימנים ${start / 3 + 1}`}
              >
                {symbols.slice(start, start + 3).map(([value, label]) => (
                  <button
                    type="button"
                    className="keyboard-symbol"
                    key={value}
                    aria-label={label}
                    onClick={() => onKey(value)}
                  >
                    <span aria-hidden="true">{value}</span>
                    <small dir="rtl">{label}</small>
                  </button>
                ))}
              </div>
            ))}
            <button type="button" onClick={() => onKey(" ")}>
              רווח
            </button>
          </div>
        </>
      )}
    </div>
  );
}

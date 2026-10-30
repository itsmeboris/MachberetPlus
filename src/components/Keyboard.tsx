export function Keyboard({
  text,
  onKey,
}: {
  text: boolean;
  onKey: (key: string) => void;
}) {
  const chars = (
    text ? "אבגדהוזחטיכלמנסעפצקרשתךםןףץ" : "1234567890+-×÷=/x()"
  ).split("");
  const rows = Array.from({ length: Math.ceil(chars.length / 5) }, (_, i) =>
    chars.slice(i * 5, i * 5 + 5),
  );
  return (
    <div className="keyboard-groups" dir="ltr">
      {rows.map((row, i) => (
        <div
          className="keyboard-row"
          data-scan-group
          key={i}
          aria-label={`קבוצת מקשים ${i + 1}`}
        >
          {row.map((char) => (
            <button key={char} onClick={() => onKey(char)}>
              {char}
            </button>
          ))}
        </div>
      ))}
      <div className="keyboard-row" data-scan-group>
        <button onClick={() => onKey("delete")}>מחיקה</button>
        <button onClick={() => onKey(" ")}>רווח</button>
      </div>
    </div>
  );
}

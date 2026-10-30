export function MathText({ value }: { value: string }) {
  const parts = value.split(/(-?\d+\s*\/\s*\d+)/g);
  return (
    <span dir="ltr" className="math-expression">
      {parts.map((part, i) => {
        const fraction = part.match(/^(-?\d+)\s*\/\s*(\d+)$/);
        return fraction ? (
          <span
            key={i}
            className="fraction"
            aria-label={`${fraction[1]} חלקי ${fraction[2]}`}
          >
            <span>{fraction[1]}</span>
            <span>{fraction[2]}</span>
          </span>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </span>
  );
}

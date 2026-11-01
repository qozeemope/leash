import { formatCents } from "../money";

interface OdometerProps {
  cents: number;
  label?: string;
}

export function Odometer({ cents, label }: OdometerProps) {
  const text = formatCents(cents);
  const symbol = text.startsWith("-") ? text.slice(0, 2) : text.slice(0, 1);
  const chars = Array.from(text.slice(symbol.length));
  return (
    <div>
      {label ? <span className="odometer-label">{label}</span> : null}
      <span className="odometer" role="img" aria-label={text}>
        <span className="odometer-fixed" aria-hidden="true">{symbol}</span>
        {chars.map((char, index) =>
          char === "," || char === "." ? (
            <span key={index} className="odometer-fixed" aria-hidden="true">{char}</span>
          ) : (
            <span key={index} className="odometer-cell" aria-hidden="true">{char}</span>
          ),
        )}
      </span>
    </div>
  );
}

const POINTS = 16;
const OUTER = 50;
const INNER = 40;

const POLYGON = Array.from({ length: POINTS * 2 }, (_, i) => {
  const radius = i % 2 === 0 ? OUTER : INNER;
  const angle = (Math.PI * i) / POINTS - Math.PI / 2;
  return `${(50 + radius * Math.cos(angle)).toFixed(1)},${(50 + radius * Math.sin(angle)).toFixed(1)}`;
}).join(" ");

export function StarBurst({ children }: { children: string }) {
  return (
    <span className="starburst">
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <polygon points={POLYGON} />
      </svg>
      <span className="starburst-label">{children}</span>
    </span>
  );
}

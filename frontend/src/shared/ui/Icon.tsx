import type { ReactNode } from "react";

export type IconName = "check" | "cross" | "pause" | "warning" | "info" | "arrow" | "play";

const LINE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const SHAPES: Record<IconName, ReactNode> = {
  check: <path d="M3.5 8.5l3 3 6-7" {...LINE} />,
  cross: <path d="M4 4l8 8M12 4l-8 8" {...LINE} />,
  pause: (
    <>
      <path d="M5.5 3.5v9" {...LINE} />
      <path d="M10.5 3.5v9" {...LINE} />
    </>
  ),
  warning: (
    <>
      <path d="M8 2.5l6 10.5H2z" {...LINE} />
      <path d="M8 6.5v3M8 11.2v.1" {...LINE} />
    </>
  ),
  info: (
    <>
      <circle cx="8" cy="8" r="6" {...LINE} />
      <path d="M8 7.5v3.5M8 5v.1" {...LINE} />
    </>
  ),
  arrow: <path d="M3 8h10M9 4l4 4-4 4" {...LINE} />,
  play: <path d="M5.5 3.5v9l7-4.5z" fill="currentColor" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />,
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {SHAPES[name]}
    </svg>
  );
}

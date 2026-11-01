import type { ReactNode } from "react";

export type IconName = "check" | "cross" | "pause" | "warning";

const SHAPES: Record<IconName, ReactNode> = {
  check: <path d="M3 8.5l3.2 3.2L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />,
  cross: <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />,
  pause: (
    <>
      <rect x="3.5" y="2.5" width="3" height="11" fill="currentColor" />
      <rect x="9.5" y="2.5" width="3" height="11" fill="currentColor" />
    </>
  ),
  warning: (
    <>
      <path d="M8 2l6.5 12H1.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6.5v3.5M8 11.6v1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </>
  ),
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {SHAPES[name]}
    </svg>
  );
}

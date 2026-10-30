import type { ReactElement } from "react";

export type Outcome = "approve" | "escalate" | "block";

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const OUTCOMES: Record<Outcome, { label: string; classes: string; icon: ReactElement }> = {
  approve: {
    label: "Approved",
    classes: "bg-approve-50 text-approve-700 ring-approve-600/25",
    icon: <Icon path="M4 10.5l4 4 8-9" />,
  },
  escalate: {
    label: "Needs your OK",
    classes: "bg-escalate-50 text-escalate-700 ring-escalate-600/25",
    icon: <Icon path="M10 4v7M10 15v.5" />,
  },
  block: {
    label: "Blocked",
    classes: "bg-block-50 text-block-700 ring-block-600/25",
    icon: <Icon path="M5 5l10 10M15 5L5 15" />,
  },
};

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const { label, classes, icon } = OUTCOMES[outcome];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${classes}`}
    >
      {icon}
      {label}
    </span>
  );
}

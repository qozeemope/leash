import type { Outcome } from "../api/types";
import type { IconName } from "./Icon";

export interface OutcomeMeta {
  label: string;
  icon: IconName;
  tagClass: string;
  stampClass: string;
  plain: string;
}

export const OUTCOMES: Record<Outcome, OutcomeMeta> = {
  approve: {
    label: "Approved",
    icon: "check",
    tagClass: "tag tag-approve",
    stampClass: "stamp stamp-approve",
    plain: "The purchase fits your rules, so it goes to PayPal checkout.",
  },
  escalate: {
    label: "Needs your OK",
    icon: "pause",
    tagClass: "tag tag-escalate",
    stampClass: "stamp stamp-escalate",
    plain: "One detail needs a human decision. You approve or deny the purchase.",
  },
  block: {
    label: "Blocked",
    icon: "cross",
    tagClass: "tag tag-block",
    stampClass: "stamp stamp-block",
    plain: "The purchase breaks a rule. No charge is made and the reasons are recorded.",
  },
};

export function outcomeOf(value: unknown): Outcome | null {
  return value === "approve" || value === "escalate" || value === "block" ? value : null;
}

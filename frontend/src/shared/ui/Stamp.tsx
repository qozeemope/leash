import { OUTCOMES, outcomeOf } from "./outcomes";

export function Stamp({ outcome }: { outcome: string | null | undefined }) {
  const known = outcomeOf(outcome);
  if (known === null) return null;
  const meta = OUTCOMES[known];
  return <span className={meta.stampClass}>{meta.label}</span>;
}

import { Icon } from "./Icon";
import { OUTCOMES, outcomeOf } from "./outcomes";

export function OutcomeBadge({ outcome }: { outcome: string | null | undefined }) {
  const known = outcomeOf(outcome);
  if (known === null) return <span className="tag">No decision needed</span>;
  const meta = OUTCOMES[known];
  return (
    <span className={meta.tagClass}>
      <Icon name={meta.icon} />
      {meta.label}
    </span>
  );
}

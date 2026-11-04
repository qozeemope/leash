import type { AgentStep } from "../../shared/api/types";
import { formatTime } from "../../shared/datetime";
import { ButtonAnchor } from "../../shared/ui/Button";
import { rememberCheckout } from "../checkout/checkoutMemory";
import { Icon } from "../../shared/ui/Icon";
import { OutcomeBadge } from "../../shared/ui/OutcomeBadge";
import { describeStep, rawDetails } from "./steps";

function itemClass(outcome: string | null, flagged: boolean): string {
  if (outcome) return `feed-item feed-${outcome}`;
  return flagged ? "feed-item feed-flag" : "feed-item";
}

export function StepFeed({ steps, mandateId }: { steps: AgentStep[]; mandateId: string }) {
  return (
    <ol className="feed" role="log" aria-label="Agent activity">
      {steps.map((step) => {
        const view = describeStep(step);
        return (
          <li key={step.id} className={itemClass(view.outcome, view.flagged)}>
            <div className="feed-head">
              <time dateTime={step.created_at}>{formatTime(step.created_at)}</time>
              <strong>{view.label}</strong>
              {view.outcome ? <OutcomeBadge outcome={view.outcome} /> : null}
              {view.untrusted ? (
                <span className="tag tag-block">
                  <Icon name="warning" />
                  Untrusted source
                </span>
              ) : null}
            </div>
            {view.summary ? <p className="feed-summary">{view.summary}</p> : null}
            {view.note ? <p className="feed-note">{view.note}</p> : null}
            {view.reasons.length > 0 ? (
              <ul className="feed-reasons">
                {view.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            {view.approveUrl ? (
              <p className="feed-action">
                <ButtonAnchor
                  href={view.approveUrl}
                  variant="primary"
                  onClick={() => rememberCheckout(view.approveUrl ?? "", { mandateId, totalCents: view.totalCents })}
                >
                  Approve payment on PayPal
                </ButtonAnchor>
                <span className="feed-hint">Opens PayPal's sandbox. Sign in with your sandbox buyer account.</span>
              </p>
            ) : null}
            <details>
              <summary>Details</summary>
              <pre className="raw">{rawDetails(step.data)}</pre>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

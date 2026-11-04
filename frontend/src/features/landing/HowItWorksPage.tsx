import { Box } from "../../shared/ui/Box";
import { ButtonLink } from "../../shared/ui/Button";
import { OUTCOMES } from "../../shared/ui/outcomes";
import { PageMeta } from "../../shared/ui/PageMeta";
import { useAuth } from "../auth/AuthContext";
import type { Outcome } from "../../shared/api/types";

const OUTCOME_ORDER: Outcome[] = ["approve", "escalate", "block"];

export function HowItWorksPage() {
  const { user } = useAuth();

  return (
    <>
      <PageMeta
        path="/how-it-works"
        title="How Leash works"
        description="The AI agent proposes a purchase. Plain rules with no AI in them decide whether it is approved, escalated to you, or blocked."
      />
      <h1>How Leash works</h1>
      <p className="lede">The agent proposes. Plain rules decide.</p>

      <Box title="How a purchase gets through">
        <ol className="steps">
          <li>
            <h3>Write a rule</h3>
            <p>Say it the way you would to a person: "up to $60 on running socks, delivered in three days."</p>
          </li>
          <li>
            <h3>Check the limits</h3>
            <p>Leash shows the budget, categories and deadlines it understood. You confirm before it signs anything.</p>
          </li>
          <li>
            <h3>The agent shops</h3>
            <p>It searches for products and proposes a cart. It can suggest, but it cannot pay on its own.</p>
          </li>
          <li>
            <h3>Plain rules decide</h3>
            <p>Code with no AI in it checks each proposal. You approve the PayPal payment yourself.</p>
          </li>
        </ol>
      </Box>

      <Box title="Every purchase gets one of three answers">
        <ul className="outcome-list">
          {OUTCOME_ORDER.map((outcome) => (
            <li key={outcome}>
              <span>
                <span className={OUTCOMES[outcome].stampClass}>{OUTCOMES[outcome].label}</span>
              </span>
              <p>{OUTCOMES[outcome].plain}</p>
            </li>
          ))}
        </ul>
      </Box>

      <Box title="What the agent cannot do" tone="card">
        <p>
          The agent cannot pay, change your limits or approve its own purchases. Text from product pages is treated as
          untrusted, so a hidden instruction on a page cannot raise a limit. If the agent is fooled, the damage is
          capped at what your rule already allows.
        </p>
      </Box>

      <ButtonLink to={user ? "/dashboard" : "/login"} variant="primary">
        {user ? "Go to dashboard" : "Sign in"}
      </ButtonLink>
    </>
  );
}

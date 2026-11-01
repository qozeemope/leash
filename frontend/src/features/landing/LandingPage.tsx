import { Box } from "../../shared/ui/Box";
import { ButtonLink } from "../../shared/ui/Button";
import { Odometer } from "../../shared/ui/Odometer";
import { OUTCOMES } from "../../shared/ui/outcomes";
import { PageMeta } from "../../shared/ui/PageMeta";
import { StarBurst } from "../../shared/ui/StarBurst";
import { SampleReceipt } from "./SampleReceipt";
import type { Outcome } from "../../shared/api/types";

const OUTCOME_ORDER: Outcome[] = ["approve", "escalate", "block"];

export function LandingPage() {
  return (
    <>
      <PageMeta
        path="/"
        title="A spending limit for AI shopping agents"
        description="Write a spending rule in plain English. Leash checks every purchase an AI agent proposes, then approves it, asks you, or blocks it, and records why."
      />

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Give your AI shopper a budget, not your credit card</h1>
          <p className="lede">
            Write one sentence about what your agent may buy. Leash turns it into a signed rule and checks every
            purchase against it before any money moves.
          </p>
          <div className="btn-row">
            <ButtonLink to="/login" variant="gold">
              Try the demo
            </ButtonLink>
            <ButtonLink to="/styleguide">See the style guide</ButtonLink>
          </div>
          <Odometer cents={6000} label="Example budget for one rule" />
        </div>
        <div className="hero-art">
          <StarBurst>Attack blocked</StarBurst>
          <SampleReceipt />
        </div>
      </section>

      <Box title="How a purchase gets through" tone="wall">
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

      <Box title="Watch Leash stop an attack" tone="gold">
        <p>
          The demo lets an agent read a product page with hidden instructions. The agent follows them. Leash blocks the
          purchase, and the audit log lists every rule that applied.
        </p>
        <ButtonLink to="/login" variant="primary">
          Open the demo
        </ButtonLink>
      </Box>
    </>
  );
}

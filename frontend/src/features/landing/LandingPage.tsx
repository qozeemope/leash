import { Box } from "../../shared/ui/Box";
import { ButtonLink } from "../../shared/ui/Button";
import { Icon } from "../../shared/ui/Icon";
import { PageMeta } from "../../shared/ui/PageMeta";
import { useAuth } from "../auth/AuthContext";
import { Doodle, HeroArt, Sparkle } from "./HeroArt";

export function LandingPage() {
  const { user } = useAuth();
  const cta = (
    <ButtonLink to={user ? "/dashboard" : "/login"} variant="primary">
      {user ? "Go to dashboard" : "Sign in"}
    </ButtonLink>
  );

  return (
    <>
      <PageMeta
        path="/"
        title="A spending limit for AI shopping agents"
        description="Write a spending rule in plain English. Leash checks every purchase an AI agent proposes, then approves it, asks you, or blocks it, and records why."
      />

      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="hero-title">
          Agents get wallets. You keep the keys.
        </h1>
        <div className="hero-side">
          <Doodle />
          <Sparkle />
          <ul className="stats">
            <li>
              <strong className="stat-value">3</strong>
              <span className="stat-label">Possible decisions for every purchase</span>
            </li>
            <li>
              <strong className="stat-value">0</strong>
              <span className="stat-label">AI models in the approval path</span>
            </li>
          </ul>
          <p className="eyebrow">Spending controls</p>
          <p>
            Write a spending rule in plain English. Leash turns it into a signed limit and checks every purchase an AI
            agent proposes before any money moves.
          </p>
          <div className="btn-row">
            {cta}
            <ButtonLink to="/how-it-works" variant="play">
              <Icon name="play" />
              How it works
            </ButtonLink>
          </div>
        </div>
        <div className="hero-art">
          <HeroArt />
        </div>
      </section>

      <Box title="Every decision is on the record" tone="focus">
        <p>
          Each purchase an agent proposes is checked against your rule. Leash approves it, asks you, or blocks it, and the
          audit log shows which rules applied and why.
        </p>
        {cta}
      </Box>
    </>
  );
}

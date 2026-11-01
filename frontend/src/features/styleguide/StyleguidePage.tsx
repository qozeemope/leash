import { useMemo, useState } from "react";
import { contrastRatio, grade, parseHex } from "../../shared/a11y/contrast";
import { Box } from "../../shared/ui/Box";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Notice } from "../../shared/ui/Notice";
import { Odometer } from "../../shared/ui/Odometer";
import { OutcomeBadge } from "../../shared/ui/OutcomeBadge";
import { PageMeta } from "../../shared/ui/PageMeta";
import { Stamp } from "../../shared/ui/Stamp";
import { StarBurst } from "../../shared/ui/StarBurst";
import { TextField } from "../../shared/ui/TextField";

const COLOR_TOKENS = [
  "ink", "navy", "navy-hi", "sky", "mist", "gold", "gold-lo", "wall", "paper", "face", "shade", "deep",
  "link", "visited", "sale", "approve", "approve-bg", "approve-ink", "escalate", "escalate-bg",
  "escalate-ink", "block", "block-bg", "block-ink",
];

function readToken(name: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
}

function Checker() {
  const [fg, setFg] = useState("ink");
  const [bg, setBg] = useState("wall");

  const result = useMemo(() => {
    const a = parseHex(readToken(fg));
    const b = parseHex(readToken(bg));
    if (!a || !b) return null;
    const ratio = contrastRatio(a, b);
    return { ratio, grade: grade(ratio) };
  }, [fg, bg]);

  return (
    <div>
      <div className="btn-row">
        <label>
          Text{" "}
          <select className="select" value={fg} onChange={(e) => setFg(e.target.value)}>
            {COLOR_TOKENS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          Background{" "}
          <select className="select" value={bg} onChange={(e) => setBg(e.target.value)}>
            {COLOR_TOKENS.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="checker-sample" style={{ color: `var(--${fg})`, background: `var(--${bg})` }}>
        The quick brown fox buys three pairs of socks.
      </p>
      {result ? (
        <p aria-live="polite">
          Contrast {result.ratio.toFixed(2)} to 1. Result: <strong>{result.grade}</strong>.
        </p>
      ) : null}
    </div>
  );
}

export function StyleguidePage() {
  const [text, setText] = useState("");
  return (
    <>
      <PageMeta title="Style guide" description="Colours, type and components used across Leash." path="/styleguide" indexable={false} />
      <h1>Style guide</h1>
      <p>Every colour comes from the web-safe 216 palette. A test fails the build if one slips in that is not.</p>

      <Box title="Colours">
        <ul className="swatches">
          {COLOR_TOKENS.map((name) => (
            <li key={name} className="swatch">
              <div className="swatch-chip" style={{ background: `var(--${name})` }} />
              <span className="swatch-name">{name}</span>
            </li>
          ))}
        </ul>
      </Box>

      <Box title="Contrast checker">
        <Checker />
      </Box>

      <Box title="Type" tone="wall">
        <h1>Heading one in Georgia</h1>
        <h2>Heading two in Georgia</h2>
        <h3>Heading three in Georgia</h3>
        <p>Body text is set in Verdana at a comfortable measure, with generous line height so long reading stays easy.</p>
      </Box>

      <Box title="Buttons">
        <div className="btn-row">
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="gold">Gold</Button>
          <Button variant="approve">Approve</Button>
          <Button variant="danger">Deny</Button>
          <Button disabled>Disabled</Button>
          <ButtonLink to="/">Link button</ButtonLink>
        </div>
      </Box>

      <Box title="Form field">
        <TextField
          multiline
          label="Spending rule"
          hint="For example: up to $60 on running socks."
          value={text}
          onChange={(e) => setText(e.target.value)}
          error={text.length > 0 && text.length < 10 ? "Add a little more detail so Leash can read it." : undefined}
        />
      </Box>

      <Box title="Notices, errors and empty states">
        <Notice>Plain information.</Notice>
        <Notice kind="success">Rule signed. The limits cannot be changed.</Notice>
        <Notice kind="warn">This purchase needs your approval.</Notice>
        <ErrorNotice
          title="Spending rules could not be loaded"
          reason="The server could not be reached."
          next="Check the connection and retry."
          action={<Button size="small">Retry</Button>}
        />
        <EmptyState
          title="Set a limit before your agent shops"
          description="A spending rule caps the budget, categories and merchants your agent can use."
          action={<ButtonLink to="/mandates/new" variant="gold">Write your first rule</ButtonLink>}
        />
      </Box>

      <Box title="Outcomes">
        <div className="btn-row">
          <OutcomeBadge outcome="approve" />
          <OutcomeBadge outcome="escalate" />
          <OutcomeBadge outcome="block" />
        </div>
        <div className="btn-row">
          <Stamp outcome="approve" />
          <Stamp outcome="escalate" />
          <Stamp outcome="block" />
        </div>
      </Box>

      <Box title="Odometer and starburst">
        <div className="btn-row">
          <Odometer cents={123456} label="Spent so far" />
          <StarBurst>Example</StarBurst>
        </div>
      </Box>
    </>
  );
}

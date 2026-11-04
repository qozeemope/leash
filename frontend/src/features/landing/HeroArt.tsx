import type { ReactNode } from "react";

function Coin({ cx, cy, r, tone, children }: { cx: number; cy: number; r: number; tone: string; children: ReactNode }) {
  return (
    <g>
      <circle className="art-shadow" cx={cx + 5} cy={cy + 6} r={r} />
      <circle className={`art-stroke ${tone}`} cx={cx} cy={cy} r={r} />
      {children}
    </g>
  );
}

export function HeroArt() {
  return (
    <svg
      className="art"
      viewBox="0 0 600 440"
      role="img"
      aria-label="A spending rule card for $60 on running socks, marked approved, in front of a $200 gift card marked blocked."
    >
      <g transform="rotate(9 390 180)">
        <rect className="art-shadow" x="242" y="62" width="320" height="206" rx="22" />
        <rect className="art-stroke art-blue" x="236" y="56" width="320" height="206" rx="22" />
        <text className="art-display" x="268" y="100" fontSize="20">Gift card</text>
        <text className="art-text" x="268" y="134" fontSize="24">$200.00</text>
        <rect className="art-stroke art-block" x="396" y="82" width="132" height="34" rx="17" />
        <text className="art-text" x="462" y="105" fontSize="15" textAnchor="middle">Blocked</text>
      </g>

      <g transform="rotate(-3 200 260)">
        <rect className="art-shadow" x="52" y="158" width="340" height="214" rx="22" />
        <rect className="art-stroke art-paper" x="44" y="150" width="340" height="214" rx="22" />
        <text className="art-text art-text-muted" x="76" y="194" fontSize="16">Spending rule</text>
        <rect className="art-stroke art-approve" x="272" y="170" width="86" height="32" rx="16" />
        <text className="art-text" x="315" y="192" fontSize="14" textAnchor="middle">Approved</text>
        <text className="art-display" x="74" y="270" fontSize="60">$60</text>
        <text className="art-text" x="76" y="304" fontSize="16">Running socks, delivered in 3 days</text>
        <rect className="art-stroke art-soft" x="76" y="322" width="250" height="14" rx="7" />
        <rect className="art-mint" x="78" y="324" width="72" height="10" rx="5" />
        <text className="art-text art-text-muted" x="76" y="358" fontSize="14">$18 spent</text>
      </g>

      <Coin cx={84} cy={118} r={34} tone="art-lavender">
        <circle className="art-stroke art-none" cx="80" cy="124" r="13" />
        <path className="art-stroke art-none" d="M90 114 L100 104" />
      </Coin>
      <Coin cx={520} cy={54} r={32} tone="art-mint">
        <path className="art-stroke art-none" d="M506 54 l10 10 l20 -22" />
      </Coin>
      <Coin cx={40} cy={398} r={28} tone="art-pink">
        <path className="art-stroke art-none" d="M30 388 l20 20 M50 388 l-20 20" />
      </Coin>
      <Coin cx={452} cy={376} r={40} tone="art-yellow">
        <text className="art-display" x="452" y="392" fontSize="46" textAnchor="middle">$</text>
      </Coin>
    </svg>
  );
}

export function Doodle() {
  return (
    <svg className="doodle" viewBox="0 0 140 80" aria-hidden="true" focusable="false">
      <path className="art-doodle" d="M6 62 C26 12 86 -2 78 34 C70 70 22 52 52 30 C76 14 108 26 126 58" />
      <path className="art-doodle" d="M112 56 L127 60 L130 44" />
    </svg>
  );
}

export function Sparkle() {
  return (
    <svg className="sparkle" viewBox="0 0 44 44" aria-hidden="true" focusable="false">
      <path className="art-doodle" d="M4 4 L40 40" />
      <circle className="art-stroke art-yellow" cx="22" cy="22" r="9" />
    </svg>
  );
}

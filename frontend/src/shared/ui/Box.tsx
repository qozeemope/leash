import { useId, type ReactNode } from "react";

type BoxTone = "plain" | "card" | "focus";

interface BoxProps {
  title: string;
  headingLevel?: 2 | 3 | 4;
  tone?: BoxTone;
  children: ReactNode;
}

export function Box({ title, headingLevel = 2, tone = "plain", children }: BoxProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const toneClass = tone === "plain" ? "" : ` block-${tone}`;
  return (
    <section className={`block${toneClass}`} aria-labelledby={id}>
      <Heading id={id} className="block-title">
        {title}
      </Heading>
      <div className="block-body">{children}</div>
    </section>
  );
}

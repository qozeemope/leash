import { useId, type ReactNode } from "react";

interface BoxProps {
  title: string;
  headingLevel?: 2 | 3 | 4;
  tone?: "plain" | "wall" | "gold";
  children: ReactNode;
}

export function Box({ title, headingLevel = 2, tone = "plain", children }: BoxProps) {
  const id = useId();
  const Heading = `h${headingLevel}` as const;
  const toneClass = tone === "plain" ? "" : ` box-${tone}`;
  return (
    <section className={`box${toneClass}`} aria-labelledby={id}>
      <Heading id={id} className="box-title">
        {title}
      </Heading>
      <div className="box-body">{children}</div>
    </section>
  );
}

import type { ReactNode } from "react";

export type NoticeKind = "info" | "success" | "warn" | "error";

const LABEL: Record<NoticeKind, string> = {
  info: "Note:",
  success: "Confirmed:",
  warn: "Warning:",
  error: "Error:",
};

interface NoticeProps {
  kind?: NoticeKind;
  title?: string;
  children?: ReactNode;
}

export function Notice({ kind = "info", title, children }: NoticeProps) {
  const kindClass = kind === "info" ? "" : ` notice-${kind}`;
  return (
    <div className={`notice${kindClass}`} role={kind === "error" ? "alert" : "status"}>
      <span className="notice-label">{LABEL[kind]}</span>
      <div className="notice-body">
        {title ? <p className="notice-title">{title}</p> : null}
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type NoticeKind = "info" | "success" | "warn" | "error";

const ICON: Record<NoticeKind, IconName> = {
  info: "info",
  success: "check",
  warn: "warning",
  error: "cross",
};

const LABEL: Record<NoticeKind, string> = {
  info: "Information",
  success: "Confirmed",
  warn: "Warning",
  error: "Error",
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
      <span className="notice-icon">
        <Icon name={ICON[kind]} />
      </span>
      <div className="notice-body">
        <span className="visually-hidden">{LABEL[kind]}: </span>
        {title ? <p className="notice-title">{title}</p> : null}
        {children ? <p>{children}</p> : null}
      </div>
    </div>
  );
}

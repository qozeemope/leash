import type { ReactNode } from "react";
import { Notice } from "./Notice";

interface ErrorNoticeProps {
  title: string;
  reason: string;
  next?: string;
  action?: ReactNode;
}

export function ErrorNotice({ title, reason, next, action }: ErrorNoticeProps) {
  return (
    <div>
      <Notice kind="error" title={title}>
        {next ? `${reason} ${next}` : reason}
      </Notice>
      {action ? <div className="btn-row">{action}</div> : null}
    </div>
  );
}

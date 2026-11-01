import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <h3 className="empty-title">{title}</h3>
      <p>{description}</p>
      <div className="btn-row">{action}</div>
    </div>
  );
}

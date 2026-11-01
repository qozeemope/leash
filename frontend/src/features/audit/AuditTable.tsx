import type { AuditEvent } from "../../shared/api/types";
import { formatDateTime } from "../../shared/datetime";
import { Button } from "../../shared/ui/Button";
import { OutcomeBadge } from "../../shared/ui/OutcomeBadge";
import { describeEvent, resolutionLabel } from "./events";
import type { GridContext } from "./AuditGrid";

export function AuditTable({ events, context }: { events: AuditEvent[]; context: GridContext }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Audit log">
      <table className="table table-wide">
        <caption className="visually-hidden">Audit log</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">What happened</th>
            <th scope="col">Outcome</th>
            <th scope="col">Rules that fired</th>
            <th scope="col">Reasons</th>
            <th scope="col">Your decision</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const view = describeEvent(event);
            const open = event.outcome === "escalate" && event.resolution === "open";
            const busy = context.pendingId === event.id;
            return (
              <tr key={event.id}>
                <td>{formatDateTime(event.created_at)}</td>
                <td>
                  <strong>{view.kindLabel}</strong>
                  {view.summary ? <div>{view.summary}</div> : null}
                </td>
                <td>
                  <OutcomeBadge outcome={event.outcome} />
                </td>
                <td>{view.rules.length > 0 ? view.rules.join(", ") : "None fired"}</td>
                <td>
                  {view.reasons.length > 0 ? (
                    <ul className="grid-reasons">
                      {view.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    "No reasons recorded"
                  )}
                </td>
                <td>
                  {open ? (
                    <div className="grid-actions">
                      <Button size="small" variant="approve" disabled={busy} onClick={() => context.onResolve(event.id, "approve")}>
                        Approve
                      </Button>
                      <Button size="small" variant="danger" disabled={busy} onClick={() => context.onResolve(event.id, "deny")}>
                        Deny
                      </Button>
                    </div>
                  ) : (
                    resolutionLabel(event.resolution)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

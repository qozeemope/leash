import { useMemo } from "react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import type { AuditEvent, ResolveDecision } from "../../shared/api/types";
import { formatDateTime } from "../../shared/datetime";
import { Button } from "../../shared/ui/Button";
import { OutcomeBadge } from "../../shared/ui/OutcomeBadge";
import { describeEvent, resolutionLabel } from "./events";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface GridContext {
  onResolve: (eventId: number, decision: ResolveDecision) => void;
  pendingId: number | null;
}

const theme = themeQuartz.withParams({
  backgroundColor: "var(--paper)",
  foregroundColor: "var(--ink)",
  headerBackgroundColor: "var(--soft)",
  headerTextColor: "var(--muted)",
  borderColor: "var(--line)",
  accentColor: "var(--link)",
  oddRowBackgroundColor: "var(--paper)",
  rowHoverColor: "var(--bg)",
  fontFamily: "'Cabin Variable', 'Gill Sans', 'Trebuchet MS', system-ui, sans-serif",
  fontSize: 15,
  headerFontWeight: 700,
  borderRadius: 10,
  wrapperBorderRadius: 0,
});

function TimeCell({ data }: ICellRendererParams<AuditEvent>) {
  return data ? <time dateTime={data.created_at}>{formatDateTime(data.created_at)}</time> : null;
}

function WhatCell({ data }: ICellRendererParams<AuditEvent>) {
  if (!data) return null;
  const view = describeEvent(data);
  return (
    <div className="grid-cell">
      <strong>{view.kindLabel}</strong>
      {view.summary ? <div>{view.summary}</div> : null}
    </div>
  );
}

function OutcomeCell({ data }: ICellRendererParams<AuditEvent>) {
  return data ? <OutcomeBadge outcome={data.outcome} /> : null;
}

function RulesCell({ data }: ICellRendererParams<AuditEvent>) {
  if (!data) return null;
  const rules = describeEvent(data).rules;
  if (rules.length === 0) return <span>None fired</span>;
  return (
    <ul className="grid-tags">
      {rules.map((rule) => (
        <li key={rule} className="tag">
          {rule}
        </li>
      ))}
    </ul>
  );
}

function ReasonsCell({ data }: ICellRendererParams<AuditEvent>) {
  if (!data) return null;
  const reasons = describeEvent(data).reasons;
  if (reasons.length === 0) return <span>No reasons recorded</span>;
  return (
    <ul className="grid-reasons">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  );
}

function DecisionCell({ data, context }: ICellRendererParams<AuditEvent, unknown, GridContext>) {
  if (!data) return null;
  if (data.outcome === "escalate" && data.resolution === "open") {
    const busy = context.pendingId === data.id;
    return (
      <div className="grid-actions">
        <Button size="small" variant="approve" disabled={busy} onClick={() => context.onResolve(data.id, "approve")}>
          Approve
        </Button>
        <Button size="small" variant="danger" disabled={busy} onClick={() => context.onResolve(data.id, "deny")}>
          Deny
        </Button>
      </div>
    );
  }
  return <span>{resolutionLabel(data.resolution)}</span>;
}

export default function AuditGrid({ events, context }: { events: AuditEvent[]; context: GridContext }) {
  const columns = useMemo<ColDef<AuditEvent>[]>(
    () => [
      { headerName: "Time", field: "created_at", cellRenderer: TimeCell, flex: 1, minWidth: 130 },
      { headerName: "What happened", cellRenderer: WhatCell, flex: 2, minWidth: 190 },
      { headerName: "Outcome", field: "outcome", cellRenderer: OutcomeCell, flex: 1, minWidth: 130 },
      { headerName: "Rules that fired", cellRenderer: RulesCell, flex: 1, minWidth: 130 },
      { headerName: "Reasons", cellRenderer: ReasonsCell, flex: 3, minWidth: 220 },
      { headerName: "Your decision", cellRenderer: DecisionCell, flex: 1, minWidth: 130 },
    ],
    [],
  );

  return (
    <div className="grid-wrap">
      <AgGridReact<AuditEvent>
        theme={theme}
        rowData={events}
        columnDefs={columns}
        context={context}
        domLayout="autoHeight"
        getRowId={(params) => String(params.data.id)}
        suppressMovableColumns
        defaultColDef={{
          sortable: false,
          resizable: true,
          wrapText: true,
          autoHeight: true,
          wrapHeaderText: true,
          autoHeaderHeight: true,
          cellStyle: { lineHeight: "1.45", paddingTop: "var(--s-2)", paddingBottom: "var(--s-2)", whiteSpace: "normal" },
        }}
        onFirstDataRendered={(event) => {
          window.requestAnimationFrame(() => event.api.resetRowHeights());
        }}
        onGridSizeChanged={(event) => event.api.resetRowHeights()}
      />
    </div>
  );
}

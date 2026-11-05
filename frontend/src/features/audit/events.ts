import type { AuditEvent, AuditEventKind, AuditResolution } from "../../shared/api/types";
import { formatCents } from "../../shared/money.ts";
import { plainReason } from "../../shared/reasons.ts";
import { describeItems } from "../agent/steps.ts";

export interface EventView {
  kindLabel: string;
  summary: string | null;
  amount: string | null;
  rules: string[];
  reasons: string[];
  rulesEmpty: string;
  reasonsEmpty: string;
}

const KIND_LABELS: Record<AuditEventKind, string> = {
  proposal: "Purchase proposed",
  order_created: "PayPal order created",
  order_failed: "Payment failed",
  order_expired: "Checkout expired",
  order_captured: "Payment captured",
};

const RULE_LABELS: Record<string, string> = {
  R_ORIGIN: "Untrusted origin",
  R_DELIVERY_UNKNOWN: "Delivery time unknown",
};

const RESOLUTION_LABELS: Record<AuditResolution, string> = {
  open: "Waiting for you",
  approved: "You approved",
  denied: "You denied",
  "n/a": "Nothing to decide",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function humanizeRule(rule: string): string {
  const known = RULE_LABELS[rule];
  if (known) return known;
  const words = rule.replace(/^R_/, "").replace(/[_-]+/g, " ").trim().toLowerCase();
  return words === "" ? rule : words.charAt(0).toUpperCase() + words.slice(1);
}

export function normalizeRules(hits: unknown): string[] {
  if (!Array.isArray(hits)) return [];
  const out: string[] = [];
  for (const hit of hits) {
    if (typeof hit === "string") out.push(hit);
    else if (isRecord(hit)) {
      const name = [hit.rule_id, hit.rule, hit.id, hit.name, hit.code].find(
        (value): value is string => typeof value === "string",
      );
      if (name) out.push(name);
    }
  }
  return out.map(humanizeRule);
}

function hitList(event: AuditEvent, payload: Record<string, unknown>): unknown[] {
  const decision = isRecord(payload.decision) ? payload.decision.hits : undefined;
  for (const source of [event.rule_hits, payload.hits, decision]) {
    const list = isRecord(source) && Array.isArray(source.hits) ? source.hits : source;
    if (Array.isArray(list) && list.length > 0) return list;
  }
  return [];
}

function hitMessages(hits: unknown[]): string[] {
  return hits.flatMap((hit) =>
    isRecord(hit) && typeof hit.message === "string" && hit.message.trim() !== "" ? [hit.message] : [],
  );
}

export function resolutionLabel(resolution: AuditResolution): string {
  return RESOLUTION_LABELS[resolution];
}

function emptyNotes(event: AuditEvent): { rules: string; reasons: string } {
  if (event.kind !== "proposal") return { rules: "Not applicable", reasons: "Payment step, no rules checked" };
  if (event.outcome === "approve") return { rules: "None, all checks passed", reasons: "Within every limit in your rule" };
  return { rules: "None fired", reasons: "No reasons recorded" };
}

export function describeEvent(event: AuditEvent): EventView {
  const payload = isRecord(event.payload) ? event.payload : {};
  const hits = hitList(event, payload);
  const fromPayload = Array.isArray(payload.reasons)
    ? payload.reasons.filter((item): item is string => typeof item === "string")
    : [];
  const reasons = [...new Set([...fromPayload, ...hitMessages(hits)])];
  return {
    kindLabel: KIND_LABELS[event.kind] ?? event.kind,
    summary: describeItems(payload),
    amount: typeof payload.total_cents === "number" ? formatCents(payload.total_cents) : null,
    rules: normalizeRules(hits),
    reasons: reasons.map(plainReason),
    rulesEmpty: emptyNotes(event).rules,
    reasonsEmpty: emptyNotes(event).reasons,
  };
}

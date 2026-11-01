import type { AgentRun, AgentStep, Outcome } from "../../shared/api/types";
import { formatCents } from "../../shared/money.ts";
import { plainReason } from "../../shared/reasons.ts";

export interface StepView {
  label: string;
  summary: string | null;
  note: string | null;
  outcome: Outcome | null;
  reasons: string[];
  untrusted: boolean;
  flagged: boolean;
  approveUrl: string | null;
  totalCents: number | null;
}

const KNOWN_LABELS: Record<string, string> = {
  search: "Searched for products",
  injection_flag: "Suspicious text in a product listing",
  proposal: "Proposed a purchase",
  propose: "Proposed a purchase",
  finished: "Finished",
  final: "Finished",
  message: "Agent note",
  error: "Agent error",
};

const SUMMARY_KEYS = ["summary", "message", "text", "query", "reason", "title"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOutcome(value: unknown): value is Outcome {
  return value === "approve" || value === "escalate" || value === "block";
}

function humanize(kind: string): string {
  const spaced = kind.replace(/[_-]+/g, " ").trim();
  return spaced.length === 0 ? "Step" : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function findOutcome(data: Record<string, unknown>): Outcome | null {
  if (isOutcome(data.outcome)) return data.outcome;
  if (isOutcome(data.decision)) return data.decision;
  for (const nested of [data.result, data.response]) {
    if (isRecord(nested) && isOutcome(nested.outcome)) return nested.outcome;
  }
  return null;
}

function findReasons(data: Record<string, unknown>): string[] {
  const candidates = [data.reasons, isRecord(data.result) ? data.result.reasons : undefined];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function describeItems(data: Record<string, unknown>): string | null {
  if (!Array.isArray(data.items)) return null;
  const parts: string[] = [];
  for (const item of data.items) {
    if (!isRecord(item) || typeof item.title !== "string") continue;
    const price = typeof item.price === "string" ? ` (${item.price})` : "";
    parts.push(`${item.title}${price}`);
  }
  if (parts.length === 0) return null;
  const total = typeof data.total_cents === "number" ? ` Total ${formatCents(data.total_cents)}.` : "";
  return `${parts.join("; ")}.${total}`;
}

export function describeStep(step: AgentStep): StepView {
  const label = KNOWN_LABELS[step.kind] ?? humanize(step.kind);
  const base: StepView = {
    label,
    summary: null,
    note: null,
    outcome: null,
    reasons: [],
    untrusted: false,
    flagged: step.kind === "injection_flag",
    approveUrl: null,
    totalCents: null,
  };

  if (typeof step.data === "string") return { ...base, summary: step.data.trim() === "" ? null : step.data };
  if (!isRecord(step.data)) return base;

  let summary: string | null = null;
  for (const key of SUMMARY_KEYS) {
    const value = step.data[key];
    if (typeof value === "string" && value.trim().length > 0) {
      summary = value;
      break;
    }
  }
  if (summary === null) summary = describeItems(step.data);

  let note: string | null = null;
  if (step.kind === "injection_flag") {
    note =
      step.data.withheld === true
        ? "Leash kept this text away from the agent."
        : "The agent was shown this text, so it may try to obey it.";
  }

  return {
    ...base,
    summary,
    note,
    outcome: findOutcome(step.data),
    reasons: findReasons(step.data).map(plainReason),
    untrusted: step.data.origin === "untrusted_content",
    totalCents: typeof step.data.total_cents === "number" ? step.data.total_cents : null,
    approveUrl: typeof step.data.approve_url === "string" && step.data.approve_url !== "" ? step.data.approve_url : null,
  };
}

export function rawDetails(data: unknown): string {
  if (typeof data === "string") return data === "" ? "(no extra details)" : data;
  const text = JSON.stringify(data, null, 2);
  return text === undefined || text === "{}" || text === "null" ? "(no extra details)" : text;
}

export function mergeRun(previous: AgentRun | undefined, next: AgentRun): AgentRun {
  if (!previous) return next;
  const seen = new Set(previous.steps.map((step) => step.id));
  const added = next.steps.filter((step) => !seen.has(step.id));
  return { ...next, steps: [...previous.steps, ...added] };
}

export function lastStepId(run: AgentRun | undefined): number {
  const last = run?.steps.at(-1);
  return last ? last.id : 0;
}

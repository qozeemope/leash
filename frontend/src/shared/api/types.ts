export type Outcome = "approve" | "escalate" | "block";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Detail {
  detail: string;
}

export interface HealthResponse {
  status: "ok" | "unavailable";
}

export interface User {
  id: number;
  username: string;
  is_demo: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface MandateTerms {
  currency: string;
  budget_cents: number;
  expires_at: string;
  allowed_categories: string[];
  per_item_cap_cents: number;
  max_items: number;
  min_merchant_rating: number;
  max_delivery_days: number | null;
  escalate_over_cents: number | null;
  blocked_merchants: string[];
}

export interface Mandate {
  id: string;
  raw_text: string;
  terms: MandateTerms;
  spent_cents: number;
  created_at: string;
}

export interface MandateCreateRequest {
  raw_text: string;
  terms: MandateTerms;
}

export interface MandateParseRequest {
  text: string;
}

export interface MandateParseResponse {
  status: "ready" | "needs_clarification";
  terms: MandateTerms | null;
  summary: string[];
  assumptions: string[];
  questions: string[];
}

export type AuditEventKind = "proposal" | "order_created" | "order_failed" | "order_expired" | "order_captured";
export type AuditResolution = "open" | "approved" | "denied" | "n/a";

export interface AuditEvent {
  id: number;
  created_at: string;
  kind: AuditEventKind;
  outcome: Outcome | "" | null;
  rule_hits: unknown;
  payload: unknown;
  resolution: AuditResolution;
}

export type ProposalKind = "add_to_cart" | "checkout";
export type ProposalOrigin = "agent" | "untrusted_content";

export interface CartItem {
  title: string;
  category: string;
  unit_price_cents: number;
  quantity?: number;
  merchant?: string;
  merchant_rating?: number | null;
  delivery_days?: number | null;
  category_path?: string[];
}

export interface ProposalRequest {
  kind: ProposalKind;
  items: CartItem[];
  currency?: string;
  origin?: ProposalOrigin;
  agent_reason?: string;
}

export interface ProposalResponse {
  outcome: Outcome;
  reasons?: string[];
  event_id: number;
  paypal_order_id?: string;
  approve_url?: string;
}

export type ResolveDecision = "approve" | "deny";

export interface ResolveRequest {
  decision: ResolveDecision;
}

export interface ResolveResponse {
  resolution: "approved" | "denied";
  reasons?: string[];
  paypal_order_id?: string;
  approve_url?: string;
}

export type OrderStatus = "pending" | "created" | "capturing" | "completed" | "failed" | "expired";

export interface CaptureResponse {
  status: OrderStatus;
}

export type AgentRunMode = "live" | "attack_gift_card" | "attack_overspend" | "attack_banned_merchant";
export type AgentRunStatus = "running" | "completed" | "failed";

export interface AgentStep {
  id: number;
  kind: string;
  data: unknown;
  created_at: string;
}

export interface AgentRun {
  id: string;
  mandate_id: string;
  mode: AgentRunMode;
  request_text: string;
  status: AgentRunStatus;
  final_message: string;
  tainted: boolean;
  created_at: string;
  steps: AgentStep[];
}

export interface AgentRunCreateRequest {
  request: string;
  mode?: AgentRunMode;
}

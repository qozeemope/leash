import { test } from "node:test";
import assert from "node:assert/strict";
import { describeStep, lastStepId, mergeRun } from "../src/features/agent/steps.ts";
import type { AgentRun, AgentStep } from "../src/shared/api/types.ts";

function step(id: number, kind: string, data: unknown): AgentStep {
  return { id, kind, data, created_at: "2026-10-31T12:00:00Z" };
}

function run(steps: AgentStep[], status: AgentRun["status"] = "running"): AgentRun {
  return {
    id: "r1",
    mandate_id: "m1",
    mode: "live",
    request_text: "socks",
    status,
    final_message: "",
    tainted: false,
    created_at: "2026-10-31T12:00:00Z",
    steps,
  };
}

test("describeStep reads a summary, outcome and reasons when present", () => {
  const view = describeStep(step(1, "proposal", { message: "Add socks", outcome: "block", reasons: ["Over budget", 5] }));
  assert.equal(view.label, "Proposed a purchase");
  assert.equal(view.summary, "Add socks");
  assert.equal(view.outcome, "block");
  assert.deepEqual(view.reasons, ["Over budget"]);
});

test("describeStep finds an outcome nested in result", () => {
  const view = describeStep(step(2, "tool_result", { result: { outcome: "approve", reasons: [] } }));
  assert.equal(view.outcome, "approve");
});

test("describeStep copes with unknown kinds and odd data", () => {
  assert.equal(describeStep(step(3, "weird_new_kind", null)).label, "Weird new kind");
  assert.equal(describeStep(step(4, "message", "hello")).summary, "hello");
  assert.equal(describeStep(step(5, "message", [1, 2])).summary, null);
  assert.equal(describeStep(step(6, "message", { outcome: "maybe" })).outcome, null);
});

test("mergeRun appends only new steps and keeps order", () => {
  const first = run([step(1, "a", {}), step(2, "b", {})]);
  const next = run([step(2, "b", {}), step(3, "c", {})], "completed");
  const merged = mergeRun(first, next);
  assert.deepEqual(merged.steps.map((s) => s.id), [1, 2, 3]);
  assert.equal(merged.status, "completed");
  assert.equal(lastStepId(merged), 3);
  assert.equal(lastStepId(undefined), 0);
});

import { rawDetails } from "../src/features/agent/steps.ts";

test("real injection_flag step explains what the agent saw", () => {
  const shown = describeStep(step(7, "injection_flag", { title: "Merino hiking socks", withheld: false, product_id: "sock-002" }));
  assert.equal(shown.label, "Suspicious text in a product listing");
  assert.equal(shown.summary, "Merino hiking socks");
  assert.equal(shown.flagged, true);
  assert.match(shown.note ?? "", /may try to obey/);
  const kept = describeStep(step(8, "injection_flag", { title: "x", withheld: true }));
  assert.match(kept.note ?? "", /kept this text away/);
});

test("real blocked proposal gets items, total, reasons and an untrusted tag", () => {
  const view = describeStep(
    step(9, "proposal", {
      items: [
        { price: "$18.00", title: "Trail running socks (2-pack)", quantity: 1, product_id: "sock-001" },
        { price: "$200.00", title: "$200 Gift Card", quantity: 1, product_id: "gc-001" },
      ],
      origin: "untrusted_content",
      outcome: "block",
      reasons: ["a", "b"],
      event_id: 17,
      approve_url: null,
      total_cents: 21800,
      paypal_order_id: null,
    }),
  );
  assert.equal(view.outcome, "block");
  assert.equal(view.untrusted, true);
  assert.equal(view.approveUrl, null);
  assert.equal(view.summary, "Trail running socks (2-pack) ($18.00); $200 Gift Card ($200.00). Total $218.00.");
  assert.deepEqual(view.reasons, ["a", "b"]);
});

test("approved proposal exposes the PayPal approve link", () => {
  const view = describeStep(step(10, "proposal", { items: [], outcome: "approve", approve_url: "https://www.sandbox.paypal.com/checkoutnow?token=X" }));
  assert.equal(view.approveUrl, "https://www.sandbox.paypal.com/checkoutnow?token=X");
});

test("plain string data and empty data are handled", () => {
  assert.equal(describeStep(step(11, "search", "socks")).summary, "socks");
  assert.equal(describeStep(step(12, "finished", "Simulation finished: stopped.")).label, "Finished");
  assert.equal(rawDetails(""), "(no extra details)");
  assert.equal(rawDetails({}), "(no extra details)");
  assert.equal(rawDetails("socks"), "socks");
  assert.match(rawDetails({ a: 1 }), /"a": 1/);
});

test("the real final step is labelled Finished", () => {
  assert.equal(describeStep(step(13, "final", "Simulation finished.")).label, "Finished");
});

test("an approved proposal exposes its total for the checkout memory", () => {
  const view = describeStep(step(14, "proposal", { outcome: "approve", total_cents: 1800, approve_url: "https://x.test/?token=T" }));
  assert.equal(view.totalCents, 1800);
  assert.equal(describeStep(step(15, "search", "socks")).totalCents, null);
});

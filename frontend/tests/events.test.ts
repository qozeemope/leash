import { test } from "node:test";
import assert from "node:assert/strict";
import { describeEvent, humanizeRule, normalizeRules } from "../src/features/audit/events.ts";
import type { AuditEvent } from "../src/shared/api/types.ts";

function event(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    id: 17,
    created_at: "2026-10-31T17:01:48Z",
    kind: "proposal",
    outcome: "block",
    rule_hits: [],
    payload: {},
    resolution: "n/a",
    ...overrides,
  };
}

test("rule names are made readable", () => {
  assert.equal(humanizeRule("R_ORIGIN"), "Untrusted origin");
  assert.equal(humanizeRule("R_PER_ITEM_CAP"), "Per item cap");
  assert.equal(humanizeRule("budget"), "Budget");
});

test("rule hits can be strings or objects, and junk is ignored", () => {
  assert.deepEqual(normalizeRules(["R_BUDGET", { rule: "R_CATEGORY" }, { id: "R_ORIGIN" }, 5, null]), [
    "Budget",
    "Category",
    "Untrusted origin",
  ]);
  assert.deepEqual(normalizeRules(undefined), []);
});

test("describeEvent reads reasons, amount and summary from the payload", () => {
  const view = describeEvent(
    event({
      rule_hits: ["R_ORIGIN", "R_BUDGET"],
      payload: {
        items: [{ title: "$200 Gift Card", price: "$200.00" }],
        reasons: ["Over the budget", 3],
        total_cents: 20000,
      },
    }),
  );
  assert.equal(view.kindLabel, "Purchase proposed");
  assert.equal(view.amount, "$200.00");
  assert.deepEqual(view.reasons, ["Over the budget"]);
  assert.deepEqual(view.rules, ["Untrusted origin", "Budget"]);
  assert.match(view.summary ?? "", /Gift Card/);
});

test("describeEvent copes with an empty or odd payload", () => {
  const view = describeEvent(event({ kind: "order_captured", payload: null }));
  assert.equal(view.kindLabel, "Payment captured");
  assert.equal(view.amount, null);
  assert.deepEqual(view.reasons, []);
});

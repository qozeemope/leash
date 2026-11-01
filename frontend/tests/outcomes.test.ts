import { test } from "node:test";
import assert from "node:assert/strict";
import { OUTCOMES, outcomeOf } from "../src/shared/ui/outcomes.ts";

test("outcomeOf accepts only the three real outcomes", () => {
  assert.equal(outcomeOf("approve"), "approve");
  assert.equal(outcomeOf("escalate"), "escalate");
  assert.equal(outcomeOf("block"), "block");
  assert.equal(outcomeOf(""), null);
  assert.equal(outcomeOf(null), null);
  assert.equal(outcomeOf(undefined), null);
  assert.equal(outcomeOf("n/a"), null);
});

test("every real outcome has display metadata", () => {
  for (const key of ["approve", "escalate", "block"] as const) {
    assert.ok(OUTCOMES[key].tagClass.length > 0);
    assert.ok(OUTCOMES[key].label.length > 0);
  }
});

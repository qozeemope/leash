import { test } from "node:test";
import assert from "node:assert/strict";
import { plainReason } from "../src/shared/reasons.ts";

test("every known policy reason is rewritten in plain language", () => {
  assert.equal(
    plainReason("Action was triggered by untrusted page/tool content, not by the user's mandate."),
    "This purchase was triggered by text on a web page, not by you.",
  );
  assert.equal(plainReason("2 items exceeds the limit of 1."), "The cart has 2 items, but your rule allows only 1.");
  assert.equal(
    plainReason("Total $218.00 (+$1299.00 already spent) exceeds the $1500.00 budget."),
    "The total, $218.00, plus $1299.00 already spent, goes over your $1500.00 budget.",
  );
  assert.equal(
    plainReason("'$200 Gift Card' is category 'gift cards', which the mandate does not allow."),
    "$200 Gift Card is in the \u201Cgift cards\u201D category, which your rule does not allow.",
  );
  assert.equal(
    plainReason("'$200 Gift Card' costs $200.00, above the $50.00 per-item cap."),
    "$200 Gift Card costs $200.00, more than your $50.00 limit for one item.",
  );
});

test("unknown reasons pass through, with the word mandate softened", () => {
  assert.equal(plainReason("Delivery time is unknown."), "Delivery time is unknown.");
  assert.equal(plainReason("Outside the mandate window."), "Outside your rule window.");
});

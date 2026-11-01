import { test } from "node:test";
import assert from "node:assert/strict";
import { dollarsToCents, formatCents } from "../src/shared/money.ts";

test("formatCents groups thousands and pads cents", () => {
  assert.equal(formatCents(0), "$0.00");
  assert.equal(formatCents(5), "$0.05");
  assert.equal(formatCents(6000), "$60.00");
  assert.equal(formatCents(123456789), "$1,234,567.89");
  assert.equal(formatCents(-250), "-$2.50");
});

test("dollarsToCents parses without floats", () => {
  assert.equal(dollarsToCents("60"), 6000);
  assert.equal(dollarsToCents("$18.5"), 1850);
  assert.equal(dollarsToCents("1,200.07"), 120007);
  assert.equal(dollarsToCents("0.29"), 29);
});

test("dollarsToCents rejects anything ambiguous", () => {
  assert.equal(dollarsToCents(""), null);
  assert.equal(dollarsToCents("12.345"), null);
  assert.equal(dollarsToCents("-5"), null);
  assert.equal(dollarsToCents("12,34"), null);
  assert.equal(dollarsToCents("abc"), null);
});

import { formatMoney } from "../src/shared/money.ts";

test("formatMoney keeps USD plain and labels other currencies", () => {
  assert.equal(formatMoney(6000, "usd"), "$60.00");
  assert.equal(formatMoney(6000, "eur"), "60.00 EUR");
});

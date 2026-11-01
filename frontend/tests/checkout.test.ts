import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { orderIdFromApproveUrl, recallCheckout, rememberCheckout } from "../src/features/checkout/checkoutMemory.ts";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  Object.assign(globalThis, {
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  });
});

const URL_OK = "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T";

test("the order id is read from the PayPal approve URL", () => {
  assert.equal(orderIdFromApproveUrl(URL_OK), "5O190127TN364715T");
  assert.equal(orderIdFromApproveUrl("https://example.com/?x=1"), null);
  assert.equal(orderIdFromApproveUrl("not a url"), null);
});

test("a checkout is remembered and recalled by order id", () => {
  rememberCheckout(URL_OK, { mandateId: "m-1", totalCents: 1800 });
  assert.deepEqual(recallCheckout("5O190127TN364715T"), { mandateId: "m-1", totalCents: 1800 });
  assert.equal(recallCheckout("OTHER"), null);
  assert.equal(recallCheckout(null), null);
});

test("a missing total is allowed, corrupt data is ignored", () => {
  rememberCheckout(URL_OK, { mandateId: "m-2", totalCents: null });
  assert.deepEqual(recallCheckout("5O190127TN364715T"), { mandateId: "m-2", totalCents: null });
  store.set("leash.checkout.BAD", "{not json");
  assert.equal(recallCheckout("BAD"), null);
  store.set("leash.checkout.ODD", JSON.stringify({ totalCents: 5 }));
  assert.equal(recallCheckout("ODD"), null);
});

test("storage that throws never breaks checkout", () => {
  Object.assign(globalThis, {
    sessionStorage: {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    },
  });
  assert.doesNotThrow(() => rememberCheckout(URL_OK, { mandateId: "m", totalCents: 1 }));
  assert.equal(recallCheckout("5O190127TN364715T"), null);
});

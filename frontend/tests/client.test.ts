import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ApiError, apiFetch } from "../src/shared/api/client.ts";

interface Call {
  url: string;
  init: RequestInit;
}

const calls: Call[] = [];
let queue: Array<Response | Error> = [];
const fakeDocument = { cookie: "" };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  calls.length = 0;
  queue = [];
  fakeDocument.cookie = "";
  Object.assign(globalThis, {
    document: fakeDocument,
    fetch: async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const next = queue.shift();
      if (!next) throw new Error("no queued response");
      if (next instanceof Error) throw next;
      return next;
    },
  });
});

function headersOf(call: Call | undefined): Record<string, string> {
  return (call?.init.headers ?? {}) as Record<string, string>;
}

test("GET sends no body and no content type", async () => {
  queue.push(json({ status: "ok" }));
  await apiFetch("/api/health/");
  assert.equal(calls[0]?.init.body, undefined);
  assert.equal(headersOf(calls[0])["Content-Type"], undefined);
});

test("POST with a body sends JSON and the CSRF cookie", async () => {
  fakeDocument.cookie = "csrftoken=abc123; sessionid=zzz";
  queue.push(json({ id: 1 }, 201));
  await apiFetch("/api/mandates/", { method: "POST", body: { raw_text: "x" } });
  const headers = headersOf(calls[0]);
  assert.equal(headers["Content-Type"], "application/json");
  assert.equal(headers["X-CSRFToken"], "abc123");
  assert.equal(calls[0]?.init.body, JSON.stringify({ raw_text: "x" }));
});

test("POST without a body sends no content type", async () => {
  fakeDocument.cookie = "csrftoken=abc123";
  queue.push(json({ status: "completed" }));
  await apiFetch("/api/orders/X/capture/", { method: "POST" });
  assert.equal(headersOf(calls[0])["Content-Type"], undefined);
  assert.equal(calls[0]?.init.body, undefined);
});

test("missing CSRF cookie triggers a fetch of the csrf endpoint first", async () => {
  queue.push(json({ detail: "ok" }));
  queue.push(json({ id: 1 }));
  await apiFetch("/api/auth/demo/", { method: "POST" });
  assert.equal(calls[0]?.url, "/api/auth/csrf/");
  assert.equal(calls[1]?.url, "/api/auth/demo/");
});

test("error envelope becomes an ApiError with a safe message", async () => {
  fakeDocument.cookie = "csrftoken=abc";
  queue.push(json({ error: { code: "order_expired", message: "That checkout has expired.", details: null } }, 410));
  await assert.rejects(
    () => apiFetch("/api/orders/X/capture/", { method: "POST" }),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 410 &&
      error.code === "order_expired" &&
      error.message === "That checkout has expired.",
  );
});

test("a response that is not an envelope gets a generic message", async () => {
  queue.push(new Response("<html>boom</html>", { status: 500 }));
  await assert.rejects(
    () => apiFetch("/api/health/"),
    (error: unknown) => error instanceof ApiError && error.status === 500 && !error.message.includes("boom"),
  );
});

test("network failure becomes network_error", async () => {
  queue.push(new TypeError("fetch failed"));
  await assert.rejects(
    () => apiFetch("/api/health/"),
    (error: unknown) => error instanceof ApiError && error.code === "network_error" && error.status === 0,
  );
});

test("204 resolves to undefined", async () => {
  fakeDocument.cookie = "csrftoken=abc";
  queue.push(new Response(null, { status: 204 }));
  const result = await apiFetch<undefined>("/api/auth/logout/", { method: "POST" });
  assert.equal(result, undefined);
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerPage } from "./ComposerPage";

const TERMS = {
  currency: "USD",
  budget_cents: 6000,
  expires_at: "2027-01-01T00:00:00Z",
  allowed_categories: ["socks"],
  per_item_cap_cents: 2500,
  max_items: 5,
  min_merchant_rating: 4,
  max_delivery_days: 3,
  escalate_over_cents: null,
  blocked_merchants: [],
};

let parseBody: unknown;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn(async (url: string) => {
  if (url === "/api/mandates/parse/") return json(parseBody);
  if (url === "/api/mandates/") {
    return json({ id: "m-1", raw_text: "x", terms: TERMS, spent_cents: 0, created_at: "2026-11-01T00:00:00Z" }, 201);
  }
  return json({ error: { code: "not_found", message: "Not found." } }, 404);
});

function renderComposer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/mandates/new"]}>
        <Routes>
          <Route path="/mandates/new" element={<ComposerPage />} />
          <Route path="/mandates/:mandateId" element={<p>Rule page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ComposerPage", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "csrftoken=test-token";
  });

  it("checks a rule, shows the limits, and signs them after confirmation", async () => {
    parseBody = { status: "ready", terms: TERMS, summary: ["Up to $60 on socks"], assumptions: [], questions: [] };
    renderComposer();

    await userEvent.type(screen.getByLabelText("What may the agent buy?"), "up to $60 on socks");
    await userEvent.click(screen.getByRole("button", { name: "Check my rule" }));

    expect(await screen.findByText("Check these limits")).toBeTruthy();
    expect(screen.getByText("Up to $60 on socks")).toBeTruthy();

    const signedBefore = fetchMock.mock.calls.filter(([url]) => url === "/api/mandates/");
    expect(signedBefore).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Sign these limits" }));
    expect(await screen.findByText("Rule page")).toBeTruthy();

    const signed = fetchMock.mock.calls.filter(([url]) => url === "/api/mandates/");
    expect(signed).toHaveLength(1);
    const init = (signed[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(String(init.body)) as { raw_text: string; terms: { budget_cents: number } };
    expect(init.method).toBe("POST");
    expect(body.raw_text).toBe("up to $60 on socks");
    expect(body.terms.budget_cents).toBe(6000);
  });

  it("asks for more detail instead of offering to sign", async () => {
    parseBody = { status: "needs_clarification", terms: null, summary: [], assumptions: [], questions: ["How much may it spend?"] };
    renderComposer();

    await userEvent.type(screen.getByLabelText("What may the agent buy?"), "buy socks");
    await userEvent.click(screen.getByRole("button", { name: "Check my rule" }));

    expect(await screen.findByText("How much may it spend?")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign these limits" })).toBeNull();
  });
});

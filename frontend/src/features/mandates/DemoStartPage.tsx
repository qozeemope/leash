import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../shared/api/client";
import type { Mandate, MandateCreateRequest, MandateTerms } from "../../shared/api/types";
import { Box } from "../../shared/ui/Box";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Notice } from "../../shared/ui/Notice";
import { PageMeta } from "../../shared/ui/PageMeta";
import { TermsList } from "./TermsList";

const SAMPLE_TEXT =
  "Up to $60 on running socks, no single item over $30, delivered within three days, merchants rated 4 or higher, never sketchyshop.com.";
const DAY_MS = 24 * 60 * 60 * 1000;

function sampleTerms(): MandateTerms {
  return {
    currency: "USD",
    budget_cents: 6000,
    expires_at: new Date(Date.now() + DAY_MS).toISOString(),
    allowed_categories: ["socks"],
    per_item_cap_cents: 3000,
    max_items: 5,
    min_merchant_rating: 4,
    max_delivery_days: 3,
    escalate_over_cents: null,
    blocked_merchants: ["sketchyshop.com"],
  };
}

export function DemoStartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [preview] = useState(sampleTerms);

  const create = useMutation<Mandate, ApiError, MandateCreateRequest>({
    mutationFn: (body) => apiFetch<Mandate>("/api/mandates/", { method: "POST", body }),
    onSuccess: async (mandate) => {
      await queryClient.invalidateQueries({ queryKey: ["mandates"] });
      navigate(`/mandates/${mandate.id}/demo`);
    },
  });

  return (
    <>
      <PageMeta title="Simulation demo" description="Try Leash with a sample rule and a simulated agent." path="/demo" indexable={false} />
      <h1>Simulation demo</h1>
      <p className="lede">Try Leash in two clicks. Leash signs a sample rule, then a simulated agent shops under it.</p>

      <Notice kind="info" title="Simulation">
        The demo uses a scripted agent and a fake product catalog. No AI model is involved, and the attack runs never
        reach PayPal. The guided purchase creates a PayPal sandbox order that you can pay with a test account.
      </Notice>

      {create.error ? (
        <ErrorNotice title="Sample rule could not be created" reason={create.error.message} next="Wait a moment and try again." />
      ) : null}

      <Box title="Start with a sample rule" tone="card">
        <p>{SAMPLE_TEXT}</p>
        <TermsList terms={preview} />
        <div className="btn-row">
          <Button
            variant="primary"
            disabled={create.isPending}
            onClick={() => create.mutate({ raw_text: SAMPLE_TEXT, terms: sampleTerms() })}
          >
            {create.isPending ? "Creating the rule" : "Create the sample rule and start"}
          </Button>
          <ButtonLink to="/dashboard">Use one of my rules instead</ButtonLink>
        </div>
      </Box>
    </>
  );
}

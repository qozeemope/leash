import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../shared/api/client";
import type { Mandate } from "../../shared/api/types";
import { formatDateTime } from "../../shared/datetime";
import { Box } from "../../shared/ui/Box";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Notice } from "../../shared/ui/Notice";
import { Odometer } from "../../shared/ui/Odometer";
import { PageMeta } from "../../shared/ui/PageMeta";
import { AgentPanel } from "../agent/AgentPanel";
import { TermsList } from "./TermsList";

export function MandatePage() {
  const { mandateId } = useParams();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["mandates", "detail", mandateId],
    queryFn: () => apiFetch<Mandate>(`/api/mandates/${encodeURIComponent(mandateId ?? "")}/`),
    enabled: Boolean(mandateId),
  });

  return (
    <>
      <PageMeta title="Spending rule" description="The signed limits for one spending rule." indexable={false} />
      <h1>Spending rule</h1>

      {isPending ? (
        <p role="status" aria-live="polite">
          Loading the rule...
        </p>
      ) : null}

      {error ? (
        <ErrorNotice
          title="Spending rule could not be loaded"
          reason={error.message}
          action={
            <>
              <Button onClick={() => void refetch()}>Retry</Button>
              <ButtonLink to="/dashboard">Back to the dashboard</ButtonLink>
            </>
          }
        />
      ) : null}

      {data ? (
        <>
          <Notice kind="success">Rule signed on {formatDateTime(data.created_at)}. The limits cannot be changed.</Notice>
          <Box title="Your words" tone="wall">
            <p>{data.raw_text || "No original text was saved."}</p>
          </Box>
          <Box title="Money">
            <div className="btn-row">
              <Odometer cents={data.spent_cents} label="Spent or set aside" />
              <Odometer cents={data.terms.budget_cents} label="Total budget" />
            </div>
          </Box>
          <Box title="Signed limits">
            <TermsList terms={data.terms} />
          </Box>
          <AgentPanel mandate={data} />
          <div className="btn-row">
            <ButtonLink to={`/mandates/${data.id}/audit`} variant="primary">
              Open the audit log
            </ButtonLink>
            <ButtonLink to="/dashboard">Back to the dashboard</ButtonLink>
          </div>
        </>
      ) : null}
    </>
  );
}

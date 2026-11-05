import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../shared/api/client";
import type { Mandate } from "../../shared/api/types";
import { formatDateTime } from "../../shared/datetime";
import { formatMoney } from "../../shared/money";
import { Box } from "../../shared/ui/Box";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Loading } from "../../shared/ui/Loading";
import { Notice } from "../../shared/ui/Notice";
import { PageMeta } from "../../shared/ui/PageMeta";
import { AgentPanel } from "../agent/AgentPanel";
import { TermsList } from "./TermsList";

export function MandatePage() {
  const { mandateId } = useParams();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["mandates", "detail", mandateId],
    queryFn: () =>
      apiFetch<Mandate>(
        `/api/mandates/${encodeURIComponent(mandateId ?? "")}/`,
      ),
    enabled: Boolean(mandateId),
  });

  return (
    <>
      <PageMeta
        title="Spending rule"
        description="The signed limits for one spending rule."
        indexable={false}
      />
      <h1>Spending rule</h1>

      {isPending ? <Loading label="Loading the rule" /> : null}

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
          <Notice kind="success">
            Rule signed on {formatDateTime(data.created_at)}. The limits cannot
            be changed.
          </Notice>
          <Box title="Original rule text" tone="card">
            <p>{data.raw_text || "No original text was saved."}</p>
          </Box>
          <Box title="Budget">
            <div className="money">
              <ul className="stats">
                <li>
                  <strong className="stat-value">
                    {formatMoney(data.spent_cents, data.terms.currency)}
                  </strong>
                  <span className="stat-label">Spent or set aside</span>
                </li>
                <li>
                  <strong className="stat-value">
                    {formatMoney(data.terms.budget_cents, data.terms.currency)}
                  </strong>
                  <span className="stat-label">Total budget</span>
                </li>
              </ul>
              <progress
                className="meter"
                max={data.terms.budget_cents}
                value={Math.min(data.spent_cents, data.terms.budget_cents)}
                aria-label="Share of the budget used"
              />
            </div>
          </Box>
          <Box title="Signed limits">
            <TermsList terms={data.terms} />
          </Box>
          <AgentPanel mandate={data} view="live" />
          <div className="btn-row">
            <ButtonLink to={`/mandates/${data.id}/audit`} variant="primary">
              Open the audit log
            </ButtonLink>
            <ButtonLink to={`/mandates/${data.id}/demo`} variant="quiet">
              Open the simulation demo
            </ButtonLink>
            <ButtonLink to="/dashboard">Back to the dashboard</ButtonLink>
          </div>
        </>
      ) : null}
    </>
  );
}

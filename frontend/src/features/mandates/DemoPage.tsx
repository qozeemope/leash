import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../shared/api/client";
import type { Mandate } from "../../shared/api/types";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Loading } from "../../shared/ui/Loading";
import { PageMeta } from "../../shared/ui/PageMeta";
import { AgentPanel } from "../agent/AgentPanel";

export function DemoPage() {
  const { mandateId } = useParams();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["mandates", "detail", mandateId],
    queryFn: () => apiFetch<Mandate>(`/api/mandates/${encodeURIComponent(mandateId ?? "")}/`),
    enabled: Boolean(mandateId),
  });

  return (
    <>
      <PageMeta title="Simulation demo" description="Simulated agent runs that show Leash approving and blocking purchases." indexable={false} />
      <h1>Simulation demo</h1>
      <p className="lede">Watch Leash approve a purchase and stop a tricked agent, without using an AI model.</p>

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
          <AgentPanel mandate={data} view="demo" />
          <div className="btn-row">
            <ButtonLink to={`/mandates/${data.id}/audit`} variant="primary">
              Open the audit log
            </ButtonLink>
            <ButtonLink to={`/mandates/${data.id}`}>Back to the rule</ButtonLink>
          </div>
        </>
      ) : null}
    </>
  );
}

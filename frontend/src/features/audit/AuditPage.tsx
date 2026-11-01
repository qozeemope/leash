import { Suspense, lazy, useState } from "react";
import { useParams } from "react-router-dom";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "../../shared/api/client";
import type { AuditEvent, Paginated, ResolveDecision, ResolveResponse } from "../../shared/api/types";
import { Button, ButtonAnchor, ButtonLink } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Notice } from "../../shared/ui/Notice";
import { ErrorBoundary } from "../../shared/ui/ErrorBoundary";
import { PageMeta } from "../../shared/ui/PageMeta";
import { rememberCheckout } from "../checkout/checkoutMemory";
import { AuditTable } from "./AuditTable";
import type { GridContext } from "./AuditGrid";

const AuditGrid = lazy(() => import("./AuditGrid"));

interface ResolveInput {
  id: number;
  decision: ResolveDecision;
}

export function AuditPage() {
  const { mandateId = "" } = useParams();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [simple, setSimple] = useState(false);

  const audit = useQuery<Paginated<AuditEvent>, ApiError>({
    queryKey: ["audit", mandateId, page],
    queryFn: () => apiFetch<Paginated<AuditEvent>>(`/api/mandates/${encodeURIComponent(mandateId)}/audit/?page=${page}`),
    placeholderData: keepPreviousData,
    enabled: mandateId !== "",
  });

  const resolve = useMutation<ResolveResponse, ApiError, ResolveInput>({
    mutationFn: ({ id, decision }) =>
      apiFetch<ResolveResponse>(`/api/audit/${id}/resolve/`, { method: "POST", body: { decision } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      await queryClient.invalidateQueries({ queryKey: ["mandates"] });
    },
  });

  const context: GridContext = {
    onResolve: (id, decision) => resolve.mutate({ id, decision }),
    pendingId: resolve.isPending ? (resolve.variables?.id ?? null) : null,
  };

  const data = audit.data;

  return (
    <>
      <PageMeta title="Audit log" description="Every decision Leash made for one spending rule, with the reasons." indexable={false} />
      <h1>Audit log</h1>
      <p>Every purchase your agent proposed, what Leash decided, and exactly which rules and reasons led to it.</p>

      {resolve.error ? (
        <ErrorNotice title="Decision could not be saved" reason={resolve.error.message} next="Refresh the log and try again." />
      ) : null}
      {resolve.data?.resolution === "denied" ? <Notice kind="info" title="Escalation denied">No charge was made.</Notice> : null}
      {resolve.data?.resolution === "approved" ? (
        <div>
          <Notice kind="success" title="Escalation approved">{resolve.data.approve_url ? "Finish the payment on PayPal." : "No payment is needed."}</Notice>
          {resolve.data.approve_url ? (
            <p>
              <ButtonAnchor
                href={resolve.data.approve_url}
                variant="gold"
                onClick={() => rememberCheckout(resolve.data?.approve_url ?? "", { mandateId, totalCents: null })}
              >
                Approve payment on PayPal
              </ButtonAnchor>
            </p>
          ) : null}
        </div>
      ) : null}

      {audit.isPending ? (
        <p role="status" aria-live="polite">
          Loading the audit log...
        </p>
      ) : null}

      {audit.error ? (
        <ErrorNotice
          title="Audit log could not be loaded"
          reason={audit.error.message}
          action={<Button onClick={() => void audit.refetch()}>Retry</Button>}
        />
      ) : null}

      {data && data.count === 0 ? (
        <EmptyState
          title="No decisions recorded"
          description="Each purchase your agent proposes is checked and logged here with the rules that applied."
          action={
            <ButtonLink to={`/mandates/${mandateId}`} variant="gold">
              Run the shopping agent
            </ButtonLink>
          }
        />
      ) : null}

      {data && data.count > 0 ? (
        <>
          <p className="small" aria-live="polite">
            {data.count} {data.count === 1 ? "decision" : "decisions"} recorded.
          </p>
          <div className="btn-row">
            <Button size="small" onClick={() => setSimple((value) => !value)} aria-pressed={simple}>
              {simple ? "Use the interactive table" : "Use the simple table"}
            </Button>
          </div>
          {simple ? (
            <AuditTable events={data.results} context={context} />
          ) : (
          <ErrorBoundary
            resetKey={`${mandateId}-${page}`}
            fallback={(error) => (
              <div>
                <Notice kind="warn" title="Simplified table shown">The interactive table could not load. The log below is complete.</Notice>
                <details>
                  <summary>Technical details</summary>
                  <pre className="raw">{error.message}</pre>
                </details>
                <AuditTable events={data.results} context={context} />
              </div>
            )}
          >
            <Suspense
              fallback={
                <p role="status" aria-live="polite">
                  Loading the table...
                </p>
              }
            >
              <AuditGrid events={data.results} context={context} />
            </Suspense>
          </ErrorBoundary>
          )}
          <div className="pager">
            <Button size="small" disabled={data.previous === null || audit.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span aria-live="polite">Page {page}</span>
            <Button size="small" disabled={data.next === null || audit.isFetching} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
            <Button size="small" onClick={() => void audit.refetch()} disabled={audit.isFetching}>
              Refresh
            </Button>
          </div>
        </>
      ) : null}

      <ButtonLink to={`/mandates/${mandateId}`}>Back to the rule</ButtonLink>
    </>
  );
}

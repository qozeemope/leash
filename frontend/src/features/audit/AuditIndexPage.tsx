import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../shared/api/client";
import type { Mandate, Paginated } from "../../shared/api/types";
import { formatDateTime } from "../../shared/datetime";
import { formatMoney } from "../../shared/money";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Loading } from "../../shared/ui/Loading";
import { PageMeta } from "../../shared/ui/PageMeta";

export function AuditIndexPage() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["mandates", "list", 1],
    queryFn: () => apiFetch<Paginated<Mandate>>("/api/mandates/?page=1"),
  });

  const only = data && data.count === 1 ? data.results[0] : undefined;
  if (only) return <Navigate to={`/mandates/${only.id}/audit`} replace />;

  return (
    <>
      <PageMeta title="Audit log" description="Choose a spending rule to see every decision made under it." path="/audit" indexable={false} />
      <h1>Audit log</h1>
      <p className="lede">Choose a spending rule to see every purchase proposed under it and why Leash decided as it did.</p>

      {isPending ? <Loading label="Loading your rules" /> : null}

      {error ? (
        <ErrorNotice
          title="Spending rules could not be loaded"
          reason={error.message}
          action={<Button onClick={() => void refetch()}>Retry</Button>}
        />
      ) : null}

      {data && data.count === 0 ? (
        <EmptyState
          title="No decisions yet"
          description="The audit log fills up once an agent proposes a purchase under one of your rules."
          action={
            <ButtonLink to="/mandates/new" variant="primary">
              Write your first rule
            </ButtonLink>
          }
        />
      ) : null}

      {data && data.count > 1 ? (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Your spending rules">
          <table className="table">
            <caption className="visually-hidden">Spending rules with their audit logs</caption>
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th scope="col">Spent</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((mandate) => (
                <tr key={mandate.id}>
                  <th scope="row">
                    <Link to={`/mandates/${mandate.id}/audit`}>{mandate.raw_text || "Untitled rule"}</Link>
                  </th>
                  <td>
                    {formatMoney(mandate.spent_cents, mandate.terms.currency)} of{" "}
                    {formatMoney(mandate.terms.budget_cents, mandate.terms.currency)}
                  </td>
                  <td>{formatDateTime(mandate.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

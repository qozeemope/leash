import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../shared/api/client";
import type { Mandate, Paginated } from "../../shared/api/types";
import { formatDateTime } from "../../shared/datetime";
import { formatMoney } from "../../shared/money";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Loading } from "../../shared/ui/Loading";

export function MandateList() {
  const [page, setPage] = useState(1);
  const { data, error, isPending, isFetching, refetch } = useQuery({
    queryKey: ["mandates", "list", page],
    queryFn: () => apiFetch<Paginated<Mandate>>(`/api/mandates/?page=${page}`),
  });

  if (isPending) {
    return <Loading label="Loading your rules" />;
  }

  if (error) {
    return (
      <ErrorNotice
        title="Spending rules could not be loaded"
        reason={error.message}
        action={<Button onClick={() => void refetch()}>Retry</Button>}
      />
    );
  }

  if (data.count === 0) {
    return (
      <EmptyState
        title="Set a limit before your agent shops"
        description="A spending rule caps the budget, categories and merchants your agent can use. Leash checks every purchase against it."
        action={
          <ButtonLink to="/mandates/new" variant="primary">
            Write your first rule
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Your spending rules">
        <table className="table">
          <caption className="visually-hidden">Your spending rules</caption>
          <thead>
            <tr>
              <th scope="col">Rule</th>
              <th scope="col">Spent</th>
              <th scope="col">Budget</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {data.results.map((mandate) => (
              <tr key={mandate.id}>
                <th scope="row">
                  <Link to={`/mandates/${mandate.id}`}>{mandate.raw_text || "Untitled rule"}</Link>
                </th>
                <td>{formatMoney(mandate.spent_cents, mandate.terms.currency)}</td>
                <td>{formatMoney(mandate.terms.budget_cents, mandate.terms.currency)}</td>
                <td>{formatDateTime(mandate.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <Button size="small" disabled={data.previous === null || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Previous
        </Button>
        <span aria-live="polite">Page {page}</span>
        <Button size="small" disabled={data.next === null || isFetching} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
      <ButtonLink to="/mandates/new" variant="primary">
        Write a new rule
      </ButtonLink>
    </div>
  );
}

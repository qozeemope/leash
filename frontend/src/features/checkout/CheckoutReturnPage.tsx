import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../shared/api/client";
import type { CaptureResponse, OrderStatus } from "../../shared/api/types";
import { Button, ButtonLink } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Notice, type NoticeKind } from "../../shared/ui/Notice";
import { Loading } from "../../shared/ui/Loading";
import { formatCents } from "../../shared/money";
import { PageMeta } from "../../shared/ui/PageMeta";
import { Stamp } from "../../shared/ui/Stamp";
import { recallCheckout } from "./checkoutMemory";

const AUTO_CHECKS = 5;
const AUTO_CHECK_MS = 2000;

interface StatusView {
  kind: NoticeKind;
  title: string;
  text: string;
  retry: boolean;
}

const STATUS_VIEW: Record<OrderStatus, StatusView> = {
  completed: { kind: "success", title: "Payment captured", text: "The charge is recorded in the audit log.", retry: false },
  capturing: { kind: "info", title: "Payment in progress", text: "PayPal has not finished processing the payment. Check again shortly.", retry: true },
  created: { kind: "warn", title: "Approval pending", text: "PayPal has not confirmed the approval yet. Check again shortly.", retry: true },
  pending: { kind: "info", title: "Order pending", text: "The order is still being set up. Check again shortly.", retry: true },
  failed: { kind: "error", title: "Payment declined", text: "PayPal rejected the payment, so no charge was made. Start a new purchase from the dashboard.", retry: false },
  expired: { kind: "error", title: "Checkout expired", text: "The order was not approved in time, so no charge was made. Start a new purchase from the dashboard.", retry: false },
};

export function CheckoutReturnPage() {
  const [params] = useSearchParams();
  const orderId = params.get("token");
  const memory = recallCheckout(orderId);
  const { mutate, data, error, isPending, isIdle } = useMutation<CaptureResponse, ApiError, string>({
    mutationFn: (id) => apiFetch<CaptureResponse>(`/api/orders/${encodeURIComponent(id)}/capture/`, { method: "POST" }),
  });
  const started = useRef(false);
  const autoChecks = useRef(0);

  useEffect(() => {
    if (orderId && !started.current) {
      started.current = true;
      mutate(orderId);
    }
  }, [orderId, mutate]);

  useEffect(() => {
    if (!orderId || !data) return undefined;
    if ((data.status === "capturing" || data.status === "pending") && autoChecks.current < AUTO_CHECKS) {
      const timer = window.setTimeout(() => {
        autoChecks.current += 1;
        mutate(orderId);
      }, AUTO_CHECK_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [data, orderId, mutate]);

  const view = data ? STATUS_VIEW[data.status] : null;

  return (
    <>
      <PageMeta title="Payment result" description="The result of your PayPal payment." path="/checkout/return" indexable={false} />
      <h1>Payment result</h1>

      {!orderId ? (
        <ErrorNotice
          title="No PayPal order found"
          reason="This page opens from PayPal after a payment and needs the order reference."
          next="Start a purchase from the dashboard."
          action={
            <ButtonLink to="/dashboard" variant="primary">
              Back to the dashboard
            </ButtonLink>
          }
        />
      ) : null}

      {orderId && (isPending || isIdle) ? (
        <Loading label="Confirming the payment with PayPal. Keep this page open." />
      ) : null}

      {view ? (
        <>
          {data?.status === "completed" ? (
            <>
              <p>
                <Stamp outcome="approve" />
              </p>
              {memory && memory.totalCents !== null ? (
                <p className="figure">
                  <span className="figure-value">{formatCents(memory.totalCents)}</span>
                  <span className="figure-label">Paid in sandbox money</span>
                </p>
              ) : null}
            </>
          ) : null}
          {view.kind === "error" ? (
            <ErrorNotice title={view.title} reason={view.text} />
          ) : (
            <Notice kind={view.kind} title={view.title}>
              {view.text}
            </Notice>
          )}
          <div className="btn-row">
            {view.retry && orderId ? <Button onClick={() => mutate(orderId)}>Check again</Button> : null}
            {memory ? (
              <>
                <ButtonLink to={`/mandates/${memory.mandateId}/audit`} variant="primary">
                  Open the audit log
                </ButtonLink>
                <ButtonLink to={`/mandates/${memory.mandateId}`}>Back to this rule</ButtonLink>
              </>
            ) : null}
            <ButtonLink to="/dashboard" variant={memory ? "default" : "primary"}>
              Back to the dashboard
            </ButtonLink>
          </div>
        </>
      ) : null}

      {error && orderId ? (
        <ErrorNotice
          title="Payment status could not be confirmed"
          reason={error.message}
          action={
            <>
              {error.status !== 410 && error.status !== 404 ? <Button onClick={() => mutate(orderId)}>Retry</Button> : null}
              <ButtonLink to="/dashboard" variant="primary">
                Back to the dashboard
              </ButtonLink>
            </>
          }
        />
      ) : null}
    </>
  );
}

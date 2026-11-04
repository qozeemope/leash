import { useSearchParams } from "react-router-dom";
import { ButtonLink } from "../../shared/ui/Button";
import { Notice } from "../../shared/ui/Notice";
import { PageMeta } from "../../shared/ui/PageMeta";
import { Stamp } from "../../shared/ui/Stamp";
import { recallCheckout } from "./checkoutMemory";

export function CheckoutCancelPage() {
  const [params] = useSearchParams();
  const memory = recallCheckout(params.get("token"));
  return (
    <>
      <PageMeta title="Payment cancelled" description="Payment on PayPal was cancelled." path="/checkout/cancel" indexable={false} />
      <h1>Payment cancelled</h1>
      <p>
        <Stamp outcome="escalate" />
      </p>
      <Notice kind="info" title="Payment cancelled">
        No charge was made.
      </Notice>
      <p>
        The order amount stays reserved against the rule budget for a limited time, then is released automatically. Start
        a new purchase from the dashboard at any time.
      </p>
      <div className="btn-row">
        {memory ? (
          <ButtonLink to={`/mandates/${memory.mandateId}`} variant="primary">
            Back to this rule
          </ButtonLink>
        ) : null}
        <ButtonLink to="/dashboard" variant={memory ? "default" : "primary"}>
          Back to the dashboard
        </ButtonLink>
      </div>
    </>
  );
}

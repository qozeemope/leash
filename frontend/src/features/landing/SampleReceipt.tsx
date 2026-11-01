import { formatCents } from "../../shared/money";
import { OutcomeBadge } from "../../shared/ui/OutcomeBadge";

export function SampleReceipt() {
  return (
    <article className="receipt" aria-labelledby="receipt-title">
      <header className="receipt-head">
        <h2 id="receipt-title">LEASH RECEIPT</h2>
        <p>Rule: up to $60 on running socks</p>
      </header>
      <hr className="receipt-rule" />
      <div className="receipt-line">
        <dl>
          <div className="receipt-row">
            <dt>Running socks, 3 pack</dt>
            <dd>{formatCents(1800)}</dd>
          </div>
        </dl>
        <OutcomeBadge outcome="approve" />
      </div>
      <div className="receipt-line receipt-line-block">
        <dl>
          <div className="receipt-row">
            <dt>Gift card, from a product page</dt>
            <dd>{formatCents(20000)}</dd>
          </div>
        </dl>
        <OutcomeBadge outcome="block" />
        <ul className="receipt-why">
          <li>Text came from an untrusted page</li>
          <li>Gift cards are not socks</li>
          <li>Over the per-item cap</li>
          <li>Over the $60 budget</li>
        </ul>
      </div>
      <hr className="receipt-rule" />
      <dl>
        <div className="receipt-row receipt-total">
          <dt>Charged</dt>
          <dd>{formatCents(1800)}</dd>
        </div>
        <div className="receipt-row">
          <dt>Left to spend</dt>
          <dd>{formatCents(4200)}</dd>
        </div>
      </dl>
    </article>
  );
}

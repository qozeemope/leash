import type { MandateTerms } from "../../shared/api/types";
import { formatDateTime } from "../../shared/datetime";
import { formatMoney } from "../../shared/money";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function TermsList({ terms }: { terms: MandateTerms }) {
  const money = (cents: number) => formatMoney(cents, terms.currency);
  const rows: Array<[string, string]> = [
    ["Total budget", money(terms.budget_cents)],
    ["Most for one item", money(terms.per_item_cap_cents)],
    ["Allowed categories", terms.allowed_categories.join(", ")],
    ["Most items in a cart", String(terms.max_items)],
    [
      "Merchant rating",
      terms.min_merchant_rating > 0 ? `${terms.min_merchant_rating} stars or higher` : "Any rating",
    ],
    [
      "Delivery",
      terms.max_delivery_days === null ? "No deadline" : `Within ${plural(terms.max_delivery_days, "day")}`,
    ],
    [
      "Asks you first above",
      terms.escalate_over_cents === null ? "Not set" : money(terms.escalate_over_cents),
    ],
    ["Blocked merchants", terms.blocked_merchants.length > 0 ? terms.blocked_merchants.join(", ") : "None"],
    ["Rule ends", formatDateTime(terms.expires_at)],
  ];

  return (
    <dl className="limits">
      {rows.map(([label, value]) => (
        <div key={label} className="limits-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

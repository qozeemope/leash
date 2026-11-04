import { Link, useLocation } from "react-router-dom";

const LABELS: Record<string, string> = {
  "how-it-works": "How it works",
  dashboard: "Dashboard",
  checkout: "Checkout",
  return: "Payment result",
  cancel: "Payment cancelled",
  mandates: "Spending rules",
  new: "New rule",
  audit: "Audit log",
};

const NO_PAGE = new Set(["checkout", "mandates"]);
const NO_CRUMBS = new Set(["login", "how-it-works"]);

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0 || NO_CRUMBS.has(parts[0] ?? "")) return null;

  const crumbs = parts.map((part, index) => ({
    label: LABELS[part] ?? (parts[index - 1] === "mandates" ? "Rule details" : "Page not found"),
    to: `/${parts.slice(0, index + 1).join("/")}`,
  }));

  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <Link to="/">Home</Link>
        </li>
        {crumbs.map((crumb, index) => (
          <li key={crumb.to}>
            {index === crumbs.length - 1 ? (
              <span aria-current="page">{crumb.label}</span>
            ) : NO_PAGE.has(parts[index] ?? "") ? (
              <span>{crumb.label}</span>
            ) : (
              <Link to={crumb.to}>{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

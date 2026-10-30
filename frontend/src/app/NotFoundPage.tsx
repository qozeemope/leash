import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-slate-600">That address doesn't lead anywhere.</p>
      <Link to="/" className="inline-block font-medium text-brand-600 hover:text-brand-700">
        Back to the dashboard
      </Link>
    </section>
  );
}

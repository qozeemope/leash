import { OutcomeBadge } from "../../shared/ui/OutcomeBadge";
import { ApiStatus } from "./ApiStatus";

export function DashboardPage() {
  return (
    <section aria-labelledby="dashboard-title" className="space-y-6">
      <div>
        <h1 id="dashboard-title" className="text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <p className="mt-1 text-slate-600">Your spending rules and agent activity will appear here.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <ApiStatus />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700">Decision badges</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <OutcomeBadge outcome="approve" />
          <OutcomeBadge outcome="escalate" />
          <OutcomeBadge outcome="block" />
        </div>
      </div>
    </section>
  );
}

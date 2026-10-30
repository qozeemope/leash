export function SandboxBanner() {
  return (
    <div role="status" className="bg-slate-900 px-4 py-2 text-center text-sm text-slate-100">
      Sandbox mode: payments use PayPal's test environment, so no real money moves.
    </div>
  );
}

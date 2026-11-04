export function SandboxStrip() {
  return (
    <aside className="sandbox-strip" aria-label="Sandbox notice">
      <p>
        <span className="sandbox-dot" aria-hidden="true" />
        Sandbox mode. Payments use PayPal test accounts and no real money moves.
      </p>
    </aside>
  );
}

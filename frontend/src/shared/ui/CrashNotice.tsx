import { ButtonLink } from "./Button";
import { ErrorNotice } from "./ErrorNotice";

export function CrashNotice({ error }: { error: Error }) {
  return (
    <div role="alert">
      <h1>This page could not be displayed</h1>
      <ErrorNotice
        title="Page error"
        reason="A display error stopped this page from loading. No charge was made and no data was changed."
        next="Return to the dashboard or reload the page."
        action={
          <ButtonLink to="/dashboard" variant="primary">
            Back to the dashboard
          </ButtonLink>
        }
      />
      <details>
        <summary>Technical details</summary>
        <pre className="raw">{error.message}</pre>
      </details>
    </div>
  );
}

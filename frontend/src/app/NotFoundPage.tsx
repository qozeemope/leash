import { ButtonLink } from "../shared/ui/Button";
import { PageMeta } from "../shared/ui/PageMeta";

export function NotFoundPage() {
  return (
    <div className="not-found">
      <PageMeta title="Page not found" description="This page does not exist on Leash." indexable={false} />
      <p className="not-found-code" aria-hidden="true">
        404
      </p>
      <h1>Page not found</h1>
      <p>The address may be mistyped, or the page may have moved. Return to the home page to continue.</p>
      <ButtonLink to="/" variant="primary">
        Go to the home page
      </ButtonLink>
    </div>
  );
}

import { useEffect, useState } from "react";

type Status = "checking" | "ok" | "down";

const LABELS: Record<Status, string> = {
  checking: "Checking the server...",
  ok: "Server connected",
  down: "Server unreachable",
};

const DOT_CLASSES: Record<Status, string> = {
  checking: "bg-slate-400",
  ok: "bg-approve-600",
  down: "bg-block-600",
};

export function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health/", { signal: controller.signal })
      .then((response) => response.json())
      .then((body: { status?: string }) => setStatus(body.status === "ok" ? "ok" : "down"))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setStatus("down");
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <p role="status" className="flex items-center gap-2 text-sm text-slate-700">
      <span className={`h-2.5 w-2.5 rounded-full ${DOT_CLASSES[status]}`} aria-hidden="true" />
      {LABELS[status]}
    </p>
  );
}

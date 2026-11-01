import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../shared/api/client";
import type { HealthResponse } from "../../shared/api/types";

export function ApiStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: () => apiFetch<HealthResponse>("/api/health/"),
    refetchInterval: 30_000,
    retry: false,
  });

  const up = data?.status === "ok";
  const text = isPending ? "Checking the server..." : up ? "The server is up." : "The server is not responding.";
  const lampClass = isPending ? "lamp" : up && !isError ? "lamp lamp-on" : "lamp lamp-off";

  return (
    <p role="status" aria-live="polite">
      <span className={lampClass} aria-hidden="true" /> {text}
    </p>
  );
}

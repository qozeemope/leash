import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "../../shared/api/client";
import type { AgentRun } from "../../shared/api/types";
import { lastStepId, mergeRun } from "./steps";

const POLL_MS = 1500;

export function agentRunKey(runId: string | null) {
  return ["agent-run", runId] as const;
}

export function useAgentRun(runId: string | null) {
  const queryClient = useQueryClient();
  return useQuery<AgentRun, ApiError>({
    queryKey: agentRunKey(runId),
    enabled: runId !== null,
    staleTime: 0,
    queryFn: async () => {
      const previous = queryClient.getQueryData<AgentRun>(agentRunKey(runId));
      const after = lastStepId(previous);
      const next = await apiFetch<AgentRun>(`/api/agent-runs/${encodeURIComponent(runId ?? "")}/?after=${after}`);
      return mergeRun(previous, next);
    },
    refetchInterval: (query) => (query.state.data?.status === "running" ? POLL_MS : false),
  });
}

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "../../shared/api/client";
import type { AgentRun, AgentRunCreateRequest, Mandate } from "../../shared/api/types";
import { Box } from "../../shared/ui/Box";
import { Button } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Loading } from "../../shared/ui/Loading";
import { Notice } from "../../shared/ui/Notice";
import { TextField } from "../../shared/ui/TextField";
import { StepFeed } from "./StepFeed";
import { describeStep } from "./steps";
import { agentRunKey, useAgentRun } from "./useAgentRun";

const REQUEST_MAX = 500;
const SECURITY_REQUEST = "Find me a good pair of socks.";

export function AgentPanel({ mandate }: { mandate: Mandate }) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const runId = params.get("run");
  const [request, setRequest] = useState(mandate.raw_text.slice(0, REQUEST_MAX));

  const start = useMutation<AgentRun, ApiError, AgentRunCreateRequest>({
    mutationFn: (body) => apiFetch<AgentRun>(`/api/mandates/${mandate.id}/agent-runs/`, { method: "POST", body }),
    onSuccess: (run) => {
      queryClient.setQueryData(agentRunKey(run.id), run);
      setParams({ run: run.id });
    },
  });

  const run = useAgentRun(runId);
  const status = run.data?.status;
  const running = status === "running";
  const previousStatus = useRef(status);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (runId) feedRef.current?.scrollIntoView({ block: "start" });
  }, [runId]);

  useEffect(() => {
    if (previousStatus.current === "running" && status && status !== "running") {
      void queryClient.invalidateQueries({ queryKey: ["mandates"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    }
    previousStatus.current = status;
  }, [status, queryClient]);

  const bought =
    run.data?.steps.some((step) => {
      const outcome = describeStep(step).outcome;
      return outcome === "approve" || outcome === "escalate";
    }) ?? false;

  const trimmed = request.trim();
  const canStart = trimmed.length > 0 && !start.isPending && !running;

  const begin = () => {
    if (!canStart) return;
    start.mutate({ request: trimmed, mode: "live" });
  };

  const canRunSecurity = !start.isPending && !running;

  const startSecurityTest = () => {
    if (!canRunSecurity) return;
    start.mutate({ request: SECURITY_REQUEST, mode: "security_test" });
  };

  return (
    <>
      <Box title="Run the shopping agent" tone="card">
        <TextField
          multiline
          label="What should the agent shop for?"
          hint="Keep it short. The agent still has to stay inside your signed limits."
          value={request}
          maxLength={REQUEST_MAX}
          onChange={(event) => setRequest(event.target.value)}
        />
        {start.error ? (
          <ErrorNotice title="Agent could not be started" reason={start.error.message} next="Wait a moment and try again." />
        ) : null}
        <Button variant="primary" onClick={begin} disabled={!canStart}>
          {start.isPending ? "Starting" : running ? "The agent is working" : "Start the agent"}
        </Button>
      </Box>

      <Box title="Security test" tone="card">
        <p>
          The agent shops a test catalog that includes a listing with hidden instructions. The AI and the policy engine
          are real. Leash blocks any purchase from a run that read those instructions. It works best with a rule about
          socks.
        </p>
        <Button variant="quiet" onClick={startSecurityTest} disabled={!canRunSecurity}>
          Run security test
        </Button>
      </Box>

      {runId ? (
        <div ref={feedRef} className="feed-anchor">
          <Box title="Agent activity">
            {run.error && !run.data ? (
              <ErrorNotice
                title="Agent activity could not be loaded"
                reason={run.error.message}
                action={<Button onClick={() => void run.refetch()}>Retry</Button>}
              />
            ) : null}

            {run.isPending && !run.data ? (
              <Loading label="Loading the run" />
            ) : null}

            {run.data ? (
              <>
                {running ? (
                  <Loading label="The agent is working. New steps appear here as they happen." />
                ) : null}

                {run.data.tainted ? (
                  <Notice kind="warn" title="Attack text detected">
                    The agent read text in a product listing that tried to give it instructions. Any purchase proposed because of that text is blocked.
                  </Notice>
                ) : null}

                {run.data.steps.length === 0 ? (
                  <p>{running ? "Waiting for the first step" : "The agent did not record any steps."}</p>
                ) : (
                  <StepFeed steps={run.data.steps} mandateId={mandate.id} />
                )}

                {run.error ? (
                  <Notice kind="warn" title="Connection interrupted">Updates resume automatically when the server responds.</Notice>
                ) : null}

                {status === "completed" ? (
                  <Notice kind={bought ? "success" : "info"} title={bought ? "Run finished" : "No purchase made"}>
                    {run.data.final_message}
                  </Notice>
                ) : null}
                {status === "failed" ? (
                  <ErrorNotice
                    title="Agent run failed"
                    reason={run.data.final_message || "The agent stopped before it finished."}
                    next="Start a new run to try again."
                  />
                ) : null}
              </>
            ) : null}
          </Box>
        </div>
      ) : null}
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "../../shared/api/client";
import type { AgentRun, AgentRunCreateRequest, AgentRunMode, Mandate } from "../../shared/api/types";
import { Box } from "../../shared/ui/Box";
import { Button } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Notice } from "../../shared/ui/Notice";
import { SelectField } from "../../shared/ui/SelectField";
import { TextField } from "../../shared/ui/TextField";
import { StepFeed } from "./StepFeed";
import { agentRunKey, useAgentRun } from "./useAgentRun";

const MODES: Array<{ value: AgentRunMode; label: string }> = [
  { value: "live", label: "Real shopping run" },
  { value: "attack_gift_card", label: "Demo attack: hidden gift card" },
  { value: "attack_overspend", label: "Demo attack: oversized order" },
  { value: "attack_banned_merchant", label: "Demo attack: banned merchant" },
];

const REQUEST_MAX = 500;

function isMode(value: string): value is AgentRunMode {
  return MODES.some((mode) => mode.value === value);
}

export function AgentPanel({ mandate }: { mandate: Mandate }) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const runId = params.get("run");
  const [request, setRequest] = useState(mandate.raw_text.slice(0, REQUEST_MAX));
  const [mode, setMode] = useState<AgentRunMode>("live");

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

  useEffect(() => {
    if (previousStatus.current === "running" && status && status !== "running") {
      void queryClient.invalidateQueries({ queryKey: ["mandates"] });
      void queryClient.invalidateQueries({ queryKey: ["audit"] });
    }
    previousStatus.current = status;
  }, [status, queryClient]);

  const trimmed = request.trim();
  const canStart = trimmed.length > 0 && !start.isPending && !running;

  const begin = () => {
    if (!canStart) return;
    start.mutate({ request: trimmed, mode });
  };

  return (
    <>
      <Box title="Run the shopping agent" tone="wall">
        <TextField
          multiline
          label="What should the agent shop for?"
          hint="Keep it short. The agent still has to stay inside your signed limits."
          value={request}
          maxLength={REQUEST_MAX}
          onChange={(event) => setRequest(event.target.value)}
        />
        <SelectField
          label="How should it run?"
          hint="Demo attacks use a fake catalog and never reach PayPal."
          value={mode}
          onChange={(event) => {
            if (isMode(event.target.value)) setMode(event.target.value);
          }}
          options={MODES}
        />
        {start.error ? (
          <ErrorNotice title="Agent could not be started" reason={start.error.message} next="Wait a moment and try again." />
        ) : null}
        <Button variant="primary" onClick={begin} disabled={!canStart}>
          {start.isPending ? "Starting..." : running ? "The agent is working..." : "Start the agent"}
        </Button>
      </Box>

      {runId ? (
        <Box title="Agent activity">
          {run.error && !run.data ? (
            <ErrorNotice
              title="Agent activity could not be loaded"
              reason={run.error.message}
              action={<Button onClick={() => void run.refetch()}>Retry</Button>}
            />
          ) : null}

          {run.isPending && !run.data ? (
            <p role="status" aria-live="polite">
              Loading the run...
            </p>
          ) : null}

          {run.data ? (
            <>
              {running ? (
                <p role="status" aria-live="polite">
                  <span className="lamp lamp-on" aria-hidden="true" /> The agent is working. New steps appear here as they happen.
                </p>
              ) : null}

              {run.data.tainted ? (
                <Notice kind="warn" title="Attack text detected">
                  The agent read text in a product listing that tried to give it instructions. Any purchase proposed because of that text is blocked.
                </Notice>
              ) : null}

              {run.data.steps.length === 0 ? (
                <p>{running ? "Waiting for the first step..." : "The agent did not record any steps."}</p>
              ) : (
                <StepFeed steps={run.data.steps} mandateId={mandate.id} />
              )}

              {run.error ? (
                <Notice kind="warn" title="Connection interrupted">Updates resume automatically when the server responds.</Notice>
              ) : null}

              {status === "completed" ? (
                <Notice kind="success" title="Run finished">{run.data.final_message}</Notice>
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
      ) : null}
    </>
  );
}

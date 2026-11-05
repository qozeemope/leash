import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "../../shared/api/client";
import type { AgentRun, AgentRunCreateRequest, AgentRunMode, Mandate } from "../../shared/api/types";
import { Box } from "../../shared/ui/Box";
import { Button } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Loading } from "../../shared/ui/Loading";
import { Notice } from "../../shared/ui/Notice";
import { TextField } from "../../shared/ui/TextField";
import { StepFeed } from "./StepFeed";
import { describeStep } from "./steps";
import { agentRunKey, useAgentRun } from "./useAgentRun";

const ATTACKS: Array<{ mode: AgentRunMode; label: string; text: string }> = [
  {
    mode: "attack_gift_card",
    label: "Hidden gift card",
    text: "A product page tells the agent to add a $200 gift card and check out.",
  },
  {
    mode: "attack_overspend",
    label: "Oversized order",
    text: "The agent tries to buy far more than the rule allows.",
  },
  {
    mode: "attack_banned_merchant",
    label: "Banned merchant",
    text: "The agent tries to buy from a merchant on the blocked list.",
  },
];

const REQUEST_MAX = 500;

type PanelView = "live" | "demo";

interface AgentPanelProps {
  mandate: Mandate;
  view: PanelView;
}

export function AgentPanel({ mandate, view }: AgentPanelProps) {
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

  const canRunDemo = !start.isPending && !running;

  const begin = () => {
    if (!canStart) return;
    start.mutate({ request: trimmed, mode: "live" });
  };

  const runDemo = (mode: AgentRunMode) => {
    if (!canRunDemo) return;
    start.mutate({ request: mandate.raw_text.trim().slice(0, REQUEST_MAX) || "Simulation", mode });
  };

  return (
    <>
      {view === "live" ? (
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
      ) : (
        <>
          <Notice kind="info" title="Simulation">
            These runs use a scripted agent and a fake product catalog. No AI model is involved. Attack runs never reach
            PayPal. The guided purchase creates a PayPal sandbox order that you can pay with a test account.
          </Notice>

          {start.error ? (
            <ErrorNotice title="Simulation could not be started" reason={start.error.message} next="Wait a moment and try again." />
          ) : null}

          <Box title="Guided purchase" tone="card">
            <p>
              The scripted agent searches the demo catalog for something that fits this rule. Leash checks it, and if it
              fits, creates a sandbox order for you to approve on PayPal.
            </p>
            <Button variant="primary" onClick={() => runDemo("demo_purchase")} disabled={!canRunDemo}>
              Run guided purchase
            </Button>
          </Box>

          <Box title="Attack simulations" tone="card">
            <p>See Leash stop an agent that has been tricked. Nothing here reaches PayPal.</p>
            <ul className="attacks">
              {ATTACKS.map((attack) => (
                <li key={attack.mode}>
                  <div>
                    <strong>{attack.label}</strong>
                    <p>{attack.text}</p>
                  </div>
                  <Button
                    size="small"
                    onClick={() => runDemo(attack.mode)}
                    disabled={!canRunDemo}
                    aria-label={`Run simulation: ${attack.label}`}
                  >
                    Run simulation
                  </Button>
                </li>
              ))}
            </ul>
          </Box>
        </>
      )}

      {runId ? (
        <div ref={feedRef} className="feed-anchor">
          <Box title={view === "demo" ? "Simulation activity" : "Agent activity"}>
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

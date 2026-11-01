import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../shared/api/client";
import type {
  Mandate,
  MandateCreateRequest,
  MandateParseRequest,
  MandateParseResponse,
} from "../../shared/api/types";
import { Box } from "../../shared/ui/Box";
import { Button } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Notice } from "../../shared/ui/Notice";
import { PageMeta } from "../../shared/ui/PageMeta";
import { TextField } from "../../shared/ui/TextField";
import { TermsList } from "./TermsList";

const MAX_LENGTH = 1000;

interface Checked {
  text: string;
  result: MandateParseResponse;
}

export function ComposerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<Checked | null>(null);

  const parse = useMutation<MandateParseResponse, ApiError, MandateParseRequest>({
    mutationFn: (body) => apiFetch<MandateParseResponse>("/api/mandates/parse/", { method: "POST", body }),
    onSuccess: (result, variables) => setChecked({ text: variables.text, result }),
  });

  const sign = useMutation<Mandate, ApiError, MandateCreateRequest>({
    mutationFn: (body) => apiFetch<Mandate>("/api/mandates/", { method: "POST", body }),
    onSuccess: async (mandate) => {
      await queryClient.invalidateQueries({ queryKey: ["mandates"] });
      navigate(`/mandates/${mandate.id}`);
    },
  });

  const trimmed = text.trim();
  const canCheck = trimmed.length > 0 && !parse.isPending && !sign.isPending;
  const ready = checked?.result.status === "ready" && checked.result.terms !== null ? checked : null;
  const needsMore = checked?.result.status === "needs_clarification" ? checked.result : null;

  const edit = (value: string) => {
    setText(value);
    setChecked(null);
    parse.reset();
    sign.reset();
  };

  const check = () => {
    if (!canCheck) return;
    sign.reset();
    parse.mutate({ text: trimmed });
  };

  const confirm = () => {
    if (!ready || ready.result.terms === null) return;
    sign.mutate({ raw_text: ready.text, terms: ready.result.terms });
  };

  return (
    <>
      <PageMeta title="New spending rule" description="Write a spending rule in plain English and check the limits before signing." path="/mandates/new" indexable={false} />
      <h1>Write a spending rule</h1>
      <p>Say what your agent may buy, how much it may spend, and any limits that matter. Nothing is signed until you confirm.</p>

      <Box title="Your rule">
        <TextField
          multiline
          label="What may the agent buy?"
          hint="For example: up to $60 on running socks, delivered within three days, only merchants rated 4 or higher."
          value={text}
          maxLength={MAX_LENGTH}
          onChange={(event) => edit(event.target.value)}
        />
        <p className="small">
          {text.length} of {MAX_LENGTH} characters
        </p>
        <Button variant="primary" onClick={check} disabled={!canCheck}>
          {parse.isPending ? "Reading your rule..." : "Check my rule"}
        </Button>
        {parse.isPending ? (
          <p role="status" aria-live="polite">
            This can take a few seconds.
          </p>
        ) : null}
      </Box>

      {parse.error ? (
        <ErrorNotice title="Rule could not be checked" reason={parse.error.message} next="Edit the rule or try again." />
      ) : null}

      {needsMore ? (
        <Box title="More detail needed" tone="wall">
          <p>The rule is missing information needed to set safe limits. Answer the questions below in the rule text, then check it again.</p>
          {needsMore.questions.length > 0 ? (
            <ul>
              {needsMore.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          ) : null}
        </Box>
      ) : null}

      {ready && ready.result.terms ? (
        <Box title="Check these limits" tone="gold">
          <p>These are the limits Leash read from the rule. The agent is held to exactly these limits once signed.</p>
          {ready.result.summary.length > 0 ? (
            <ul>
              {ready.result.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {ready.result.assumptions.length > 0 ? (
            <Notice kind="warn" title="Assumptions made">
              {ready.result.assumptions.join(" ")} If any assumption is wrong, change the rule and check it again.
            </Notice>
          ) : null}
          <TermsList terms={ready.result.terms} />
          {sign.error ? (
            <ErrorNotice title="Rule could not be signed" reason={sign.error.message} next="Review the limits and try again." />
          ) : null}
          <div className="btn-row">
            <Button variant="approve" onClick={confirm} disabled={sign.isPending}>
              {sign.isPending ? "Signing..." : "Sign these limits"}
            </Button>
            <Button onClick={() => edit(ready.text)} disabled={sign.isPending}>
              Change my rule
            </Button>
          </div>
        </Box>
      ) : null}
    </>
  );
}

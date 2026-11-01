import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../shared/api/client";
import type { LoginRequest, User } from "../../shared/api/types";
import { Box } from "../../shared/ui/Box";
import { Button } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { PageMeta } from "../../shared/ui/PageMeta";
import { TextField } from "../../shared/ui/TextField";
import { useAuth } from "./AuthContext";

const HOME = "/dashboard";

function readFrom(state: unknown): string {
  if (typeof state === "object" && state !== null && "from" in state) {
    const from = (state as { from: unknown }).from;
    if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) return from;
  }
  return HOME;
}

export function LoginPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = readFrom(location.state);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const onSuccess = (signedIn: User) => {
    signIn(signedIn);
    navigate(from, { replace: true });
  };

  const login = useMutation<User, ApiError, LoginRequest>({
    mutationFn: (body) => apiFetch<User>("/api/auth/login/", { method: "POST", body }),
    onSuccess,
  });

  const demo = useMutation<User, ApiError>({
    mutationFn: () => apiFetch<User>("/api/auth/demo/", { method: "POST" }),
    onSuccess,
  });

  if (user) return <Navigate to={from} replace />;

  const busy = login.isPending || demo.isPending;
  const failure = login.error ?? demo.error;
  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    demo.reset();
    login.mutate({ username: username.trim(), password });
  };

  const startDemo = () => {
    login.reset();
    demo.mutate();
  };

  return (
    <>
      <PageMeta title="Sign in" description="Sign in to Leash or open a private demo account." path="/login" indexable={false} />
      <h1>Sign in</h1>

      {failure ? (
        <ErrorNotice
          title={demo.error ? "Demo account could not be opened" : "Sign-in failed"}
          reason={failure.message}
          next={demo.error ? "Try again in a moment." : "Check the username and password and try again."}
        />
      ) : null}

      <Box title="Try the demo" tone="gold">
        <p>
          One click opens a private demo account that uses sandbox payments. Its data is visible only to you and is
          removed during routine cleanup.
        </p>
        <Button variant="primary" onClick={startDemo} disabled={busy}>
          {demo.isPending ? "Opening the demo..." : "Open the demo"}
        </Button>
      </Box>

      <Box title="Sign in with your account">
        <form onSubmit={submit} noValidate>
          <TextField
            label="Username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {login.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Box>
    </>
  );
}

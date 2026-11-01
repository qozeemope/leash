import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequireAuth } from "./RequireAuth";

interface FakeAuth {
  user: { id: number } | null;
  loading: boolean;
  error: { message: string } | null;
  retry: () => void;
}

const auth = vi.hoisted(() => ({
  current: { user: null, loading: false, error: null, retry: () => {} } as FakeAuth,
}));

vi.mock("./AuthContext", () => ({ useAuth: () => auth.current }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<p>Secret page</p>} />
        </Route>
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    auth.current = { user: null, loading: false, error: null, retry: () => {} };
  });

  it("waits while the session is being checked", () => {
    auth.current = { ...auth.current, loading: true };
    renderAt("/dashboard");
    expect(screen.getByText("Checking your session...")).toBeTruthy();
    expect(screen.queryByText("Secret page")).toBeNull();
  });

  it("sends signed-out visitors to the login page", () => {
    renderAt("/dashboard");
    expect(screen.getByText("Login page")).toBeTruthy();
    expect(screen.queryByText("Secret page")).toBeNull();
  });

  it("lets signed-in users through", () => {
    auth.current = { ...auth.current, user: { id: 1 } };
    renderAt("/dashboard");
    expect(screen.getByText("Secret page")).toBeTruthy();
  });

  it("shows an error with a retry button when the session check fails", async () => {
    const retry = vi.fn();
    auth.current = { ...auth.current, error: { message: "Can't reach the server." }, retry };
    renderAt("/dashboard");
    expect(screen.getByText("Session could not be checked")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

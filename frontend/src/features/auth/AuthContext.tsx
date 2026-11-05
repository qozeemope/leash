import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "../../shared/api/client";
import type { User } from "../../shared/api/types";

const ME_KEY = ["auth", "me"] as const;

interface AuthValue {
  user: User | null;
  loading: boolean;
  error: ApiError | null;
  retry: () => void;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

async function fetchMe(): Promise<User | null> {
  try {
    return await apiFetch<User>("/api/auth/me/");
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 60_000, retry: false });
  const { refetch } = query;

  const value = useMemo<AuthValue>(
    () => ({
      user: query.data ?? null,
      loading: query.isPending,
      error: query.error instanceof ApiError ? query.error : null,
      retry: () => {
        void refetch();
      },
      signIn: (user) => {
        queryClient.setQueryData(ME_KEY, user);
      },
      signOut: async () => {
        try {
          await apiFetch<undefined>("/api/auth/logout/", { method: "POST" });
        } finally {
          await queryClient.cancelQueries();
          queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] });
          queryClient.setQueryData(ME_KEY, null);
        }
      },
    }),
    [query.data, query.isPending, query.error, refetch, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

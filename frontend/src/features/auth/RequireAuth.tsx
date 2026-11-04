import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Button } from "../../shared/ui/Button";
import { ErrorNotice } from "../../shared/ui/ErrorNotice";
import { Loading } from "../../shared/ui/Loading";
import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const { user, loading, error, retry } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading label="Checking your session" />;
  }

  if (error) {
    return (
      <ErrorNotice
        title="Session could not be checked"
        reason={error.message}
        action={<Button onClick={retry}>Retry</Button>}
      />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}

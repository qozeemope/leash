import { Box } from "../../shared/ui/Box";
import { Notice } from "../../shared/ui/Notice";
import { PageMeta } from "../../shared/ui/PageMeta";
import { useAuth } from "../auth/AuthContext";
import { MandateList } from "../mandates/MandateList";
import { ApiStatus } from "./ApiStatus";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <PageMeta title="Dashboard" description="Your spending mandates and agent activity." path="/dashboard" indexable={false} />
      <h1>Your dashboard</h1>

      {user?.is_demo ? (
        <Notice kind="info">Demo account active. Data here is visible only to you and is removed during routine cleanup.</Notice>
      ) : null}

      <Box title="Spending rules" tone="wall">
        <MandateList />
      </Box>

      <Box title="System status">
        <ApiStatus />
      </Box>
    </>
  );
}

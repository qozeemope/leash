import { Box } from "../../shared/ui/Box";
import { Notice } from "../../shared/ui/Notice";
import { PageMeta } from "../../shared/ui/PageMeta";
import { useAuth } from "../auth/AuthContext";
import { MandateList } from "../mandates/MandateList";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <>
      <PageMeta title="Dashboard" description="Your spending rules and agent activity." path="/dashboard" indexable={false} />
      <h1>Dashboard</h1>

      {user?.is_demo ? (
        <Notice kind="info">Demo workspace. Data here is visible only to you and is removed during routine cleanup.</Notice>
      ) : null}

      <Box title="Spending rules" tone="card">
        <MandateList />
      </Box>
    </>
  );
}

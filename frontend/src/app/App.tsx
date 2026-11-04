import { Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";
import { LandingPage } from "../features/landing/LandingPage";
import { HowItWorksPage } from "../features/landing/HowItWorksPage";
import { LoginPage } from "../features/auth/LoginPage";
import { RequireAuth } from "../features/auth/RequireAuth";
import { ComposerPage } from "../features/mandates/ComposerPage";
import { AuditPage } from "../features/audit/AuditPage";
import { MandatePage } from "../features/mandates/MandatePage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { CheckoutReturnPage } from "../features/checkout/CheckoutReturnPage";
import { CheckoutCancelPage } from "../features/checkout/CheckoutCancelPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<LandingPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="mandates/new" element={<ComposerPage />} />
          <Route path="mandates/:mandateId" element={<MandatePage />} />
          <Route path="mandates/:mandateId/audit" element={<AuditPage />} />
          <Route path="checkout/return" element={<CheckoutReturnPage />} />
          <Route path="checkout/cancel" element={<CheckoutCancelPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

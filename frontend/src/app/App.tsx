import { BrowserRouter, Route, Routes } from "react-router-dom";

import { LoginPage } from "../features/auth/LoginPage";
import { CheckoutCancelPage } from "../features/checkout/CheckoutCancelPage";
import { CheckoutReturnPage } from "../features/checkout/CheckoutReturnPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { AppShell } from "./AppShell";
import { NotFoundPage } from "./NotFoundPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="checkout/return" element={<CheckoutReturnPage />} />
          <Route path="checkout/cancel" element={<CheckoutCancelPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

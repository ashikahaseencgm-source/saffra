import { Routes, Route } from "react-router-dom";
import { Toaster } from "@saffra/ui";
import { AppShell } from "./components/layout/AppShell.js";
import { ProtectedRoute } from "./components/layout/ProtectedRoute.js";
import { OnboardingGate } from "./components/onboarding/OnboardingGate.js";
import { OnboardingPage } from "./pages/Onboarding.js";
import { LoginPage } from "./pages/Login.js";
import { PayPublicPage } from "./pages/PayPublic.js";
import { GuestMenuPage } from "./pages/guest/GuestMenu.js";
import { TableQrCodesPage } from "./pages/TableQrCodes.js";
import { LoyaltyPage } from "./pages/Loyalty.js";
import { DashboardPage } from "./pages/Dashboard.js";
import { TablesPage } from "./pages/Tables.js";
import { OrderWorkspacePage } from "./pages/OrderWorkspace.js";
import { OrderHistoryPage } from "./pages/OrderHistory.js";
import { MenuManagementPage } from "./pages/MenuManagement.js";
import { PaymentsPage } from "./pages/Payments.js";
import { KitchenPage } from "./pages/Kitchen.js";
import { ReportsPage } from "./pages/Reports.js";
import { StaffPage } from "./pages/Staff.js";
import { SettingsPage } from "./pages/Settings.js";
import { ReceiptPage } from "./pages/Receipt.js";
import { NotFoundPage } from "./pages/NotFound.js";

export function App() {
  return (
    <OnboardingGate>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/pay/:token" element={<PayPublicPage />} />
        {/* Guest self-ordering from a table's QR code — public, no login. */}
        <Route path="/t/:token" element={<GuestMenuPage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tables" element={<TablesPage />} />
          <Route path="/order/:orderId" element={<OrderWorkspacePage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/orders/:orderId/receipt" element={<ReceiptPage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
          <Route path="/payments" element={<PaymentsPage />} />

          <Route
            path="/menu"
            element={
              <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
                <MenuManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tables/qr"
            element={
              <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
                <TableQrCodesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/loyalty"
            element={
              <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
                <LoyaltyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute roles={["MANAGER", "ADMIN"]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </OnboardingGate>
  );
}

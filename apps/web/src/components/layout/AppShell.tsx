import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.js";
import { Topbar } from "./Topbar.js";
import { useRealtime } from "../../hooks/useRealtime.js";
import { ProductTour } from "../tour/ProductTour.js";
import { authApi } from "../../api/auth.js";
import { useAuthStore } from "../../store/authStore.js";
import { useUiStore } from "../../store/uiStore.js";

export function AppShell() {
  useRealtime();

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { tourOpen, setTourOpen } = useUiStore();

  // Auto-shows once per account (tracked server-side via tourCompletedAt, so
  // it follows the person across whichever device they sign in on) — never
  // for an account created through onboarding, which marks its own tour
  // seen since that wizard already covered the basics.
  const showTour = tourOpen || (!!user && !user.tourCompletedAt);

  async function finishTour() {
    setTourOpen(false);
    try {
      const updated = await authApi.completeTour();
      setUser(updated);
    } catch {
      // Best-effort — if this fails the tour just shows again next login,
      // which is a harmless (if mildly repetitive) outcome, not worth
      // blocking on.
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <ProductTour open={showTour} onFinish={finishTour} />
    </div>
  );
}

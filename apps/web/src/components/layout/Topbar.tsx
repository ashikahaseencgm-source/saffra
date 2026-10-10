import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Bell, LogOut, ChevronDown } from "lucide-react";
import { useAuthStore } from "../../store/authStore.js";
import { authApi } from "../../api/auth.js";
import { reportsApi } from "../../api/reports.js";
import { settingsApi } from "../../api/settings.js";
import { GuestRequestsButton } from "../guest/GuestRequestsButton.js";

export function Topbar() {
  const navigate = useNavigate();
  const { user, refreshToken, clear } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: stats } = useQuery({ queryKey: ["dashboard", "topbar"], queryFn: reportsApi.dashboard, refetchInterval: 20000 });
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });

  const handleLogout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // best-effort — clear local session regardless
    }
    clear();
    navigate("/login");
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() ?? "S";

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-borderc bg-white px-6">
      <div className="flex items-center gap-3">
        <p className="font-display text-sm font-semibold text-primary">{settings?.restaurant.name ?? "Saffra Bistro"}</p>
        {settings && !settings.payment.razorpayConfigured && (
          <span className="hidden rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent md:inline-flex">
            Demo Payment Mode
          </span>
        )}
      </div>

      <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-xl border border-borderc bg-bg px-3.5 py-2 text-sm text-muted md:flex">
        <Search className="h-4 w-4 shrink-0" />
        <input
          placeholder="Search orders, tables, menu…"
          className="w-full bg-transparent text-primary outline-none placeholder:text-muted"
        />
      </div>

      <div className="flex items-center gap-3">
        <GuestRequestsButton />
        <button className="relative rounded-xl p-2 text-muted transition-colors hover:bg-bg hover:text-primary" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {!!stats?.pendingPayments && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {stats.pendingPayments}
            </span>
          )}
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-bg"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-secondary font-display text-sm font-bold text-white">
              {initial}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-tight text-primary">{user?.name ?? "Guest"}</p>
              <p className="text-xs leading-tight text-muted">
                {formatRole(user?.role)} • {user?.employeeId}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-borderc bg-white shadow-elevated animate-slide-up">
                <div className="border-b border-borderc px-3.5 py-3">
                  <p className="text-sm font-semibold text-primary">{user?.name}</p>
                  <p className="text-xs text-muted">{formatRole(user?.role)}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/5"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function formatRole(role?: string) {
  if (!role) return "";
  return role.charAt(0) + role.slice(1).toLowerCase();
}

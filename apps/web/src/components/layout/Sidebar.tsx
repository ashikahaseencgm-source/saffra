import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@saffra/ui";
import { useAuthStore } from "../../store/authStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { NAV_ITEMS } from "./navConfig.js";
import logoIcon from "../../assets/logo.png";

// Collapsed by default to save screen space; hovering expands it as an
// overlay (fixed position) so it never pushes or reflows page content.
// Also force-expands while the product tour is stepping through pages, so
// the active nav item reads with its label instead of a bare icon.
export function Sidebar() {
  const [hovered, setHovered] = useState(false);
  const role = useAuthStore((s) => s.user?.role);
  const tourActive = useUiStore((s) => s.tourActive);
  const expanded = hovered || tourActive;
  const items = NAV_ITEMS.filter((item) => !role || item.roles.includes(role));

  return (
    <>
      <div className="h-screen w-[76px] shrink-0" />
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "fixed left-0 top-0 z-30 flex h-screen flex-col overflow-hidden border-r border-borderc bg-primary transition-[width] duration-200 ease-out",
          expanded ? "w-64 shadow-2xl" : "w-[76px]",
        )}
      >
        <div className="absolute inset-0 bg-dot-grid bg-dot-sm opacity-[0.05]" />

        <div className={cn("relative flex items-center gap-2.5 px-5 py-6", !expanded && "justify-center px-0")}>
          <img src={logoIcon} alt="Saffra" className="h-9 w-9 shrink-0 rounded-lg" />
          {expanded && <span className="whitespace-nowrap font-display text-lg font-bold tracking-tight text-white">Saffra</span>}
        </div>

        <nav className="relative flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90",
                  !expanded && "justify-center",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-accent to-secondary" />
                  )}
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {expanded && <span className="whitespace-nowrap">{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="relative mx-3 mb-5 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-[11px] font-medium text-white/40">
          {expanded ? "Hover away to collapse" : "···"}
        </div>
      </aside>
    </>
  );
}

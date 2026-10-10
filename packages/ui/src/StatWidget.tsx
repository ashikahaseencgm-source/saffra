import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "./utils.js";

export function StatWidget({
  label,
  value,
  icon,
  tone = "primary",
  trend,
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: "primary" | "accent" | "secondary" | "success";
  trend?: { value: number; label?: string };
  hint?: string;
}) {
  const gradients: Record<string, string> = {
    primary: "from-primary to-primary/70",
    accent: "from-accent to-[#EC6F8A]",
    secondary: "from-secondary to-blue-400",
    success: "from-success to-emerald-400",
  };

  return (
    <div className="group relative overflow-hidden rounded-card border border-borderc bg-white p-5 shadow-card transition-shadow hover:shadow-elevated">
      <div
        className={cn(
          "absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-[0.08] transition-transform duration-300 group-hover:scale-125",
          gradients[tone],
        )}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold text-primary">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
          {trend && (
            <div
              className={cn(
                "mt-2 inline-flex items-center gap-1 text-xs font-semibold",
                trend.value >= 0 ? "text-success" : "text-danger",
              )}
            >
              {trend.value >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
              {Math.abs(trend.value)}% {trend.label ?? "vs yesterday"}
            </div>
          )}
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", gradients[tone])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

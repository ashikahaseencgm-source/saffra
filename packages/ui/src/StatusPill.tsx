import type { ReactNode } from "react";
import { cn } from "./utils.js";

export type PillTone = "neutral" | "info" | "warning" | "success" | "danger" | "accent";

const TONE_STYLES: Record<PillTone, string> = {
  neutral: "bg-muted/10 text-muted",
  info: "bg-secondary/10 text-secondary",
  warning: "bg-warning/10 text-warning",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  accent: "bg-accent/10 text-accent",
};

const DOT_STYLES: Record<PillTone, string> = {
  neutral: "bg-muted",
  info: "bg-secondary",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
  accent: "bg-accent",
};

export function StatusPill({
  tone = "neutral",
  children,
  pulse,
  className,
}: {
  tone?: PillTone;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide",
        TONE_STYLES[tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_STYLES[tone], pulse && "animate-pulse-glow")} />
      {children}
    </span>
  );
}

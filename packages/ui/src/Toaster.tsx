import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { subscribeToasts, toast, type ToastItem, type ToastTone } from "./toastStore.js";
import { cn } from "./utils.js";

const ICONS: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const STYLES: Record<ToastTone, string> = {
  success: "border-success/30 bg-white [&_svg]:text-success",
  error: "border-danger/30 bg-white [&_svg]:text-danger",
  info: "border-secondary/30 bg-white [&_svg]:text-secondary",
  warning: "border-warning/30 bg-white [&_svg]:text-warning",
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((item) => {
        const Icon = ICONS[item.tone];
        return (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-elevated animate-slide-up",
              STYLES[item.tone],
            )}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-primary">{item.title}</p>
              {item.description && <p className="mt-0.5 text-xs text-muted">{item.description}</p>}
            </div>
            <button onClick={() => toast.dismiss(item.id)} className="shrink-0 text-muted hover:text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

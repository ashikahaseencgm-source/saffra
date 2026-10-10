import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./utils.js";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  if (!open) return null;

  const sizes = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative w-full rounded-card bg-white shadow-elevated animate-slide-up max-h-[90vh] flex flex-col",
          sizes[size],
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-borderc px-6 py-4">
            <h2 className="text-lg font-display font-semibold text-primary">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-bg hover:text-primary"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="border-t border-borderc px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

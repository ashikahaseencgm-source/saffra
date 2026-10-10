import { type InputHTMLAttributes, forwardRef, type ReactNode } from "react";
import { cn } from "./utils.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  /** Constrains/positions the field as a whole (e.g. `max-w-xs` in a filter bar). */
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, wrapperClassName, label, error, icon, trailing, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className={cn("w-full", wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-primary">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-11 w-full rounded-xl border border-borderc bg-white px-3.5 text-sm text-primary placeholder:text-muted/70",
              "transition-shadow focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary",
              icon && "pl-10",
              trailing && "pr-10",
              error && "border-danger focus:ring-danger/30 focus:border-danger",
              className,
            )}
            {...props}
          />
          {trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">{trailing}</span>}
        </div>
        {error && <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

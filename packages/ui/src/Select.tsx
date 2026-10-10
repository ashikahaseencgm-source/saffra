import { type SelectHTMLAttributes, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./utils.js";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, wrapperClassName, label, id, children, ...props }, ref) => {
  const selectId = id ?? props.name;
  return (
    <div className={cn("w-full", wrapperClassName)}>
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-primary">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-11 w-full appearance-none rounded-xl border border-borderc bg-white px-3.5 pr-9 text-sm text-primary",
            "focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
});
Select.displayName = "Select";

import { cn } from "@/lib/cn";
import type { SelectHTMLAttributes } from "react";
import { forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, className, id, children, ...props },
  ref
) {
  const selectId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="font-body text-[13px] font-semibold text-ink">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={!!error}
        className={cn(
          "rounded-sm border bg-white px-3 py-2 font-body text-[15px] text-ink transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-stamp",
          "disabled:cursor-not-allowed disabled:bg-paper-deep disabled:text-ink-muted",
          error ? "border-error" : "border-border",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="font-body text-[12.5px] text-error">{error}</p>}
    </div>
  );
});

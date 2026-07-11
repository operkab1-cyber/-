import { cn } from "@/lib/cn";
import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

// Состояния default/focus/error/disabled — UX Bible §16.1 ("поля ввода с
// состояниями"), токены из Tamga_Green_Design_Tokens.md.
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, className, id, ...props },
  ref
) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-body text-[13px] font-semibold text-ink">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={cn(
          "rounded-sm border bg-white px-3 py-2 font-body text-[15px] text-ink transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-stamp",
          "disabled:cursor-not-allowed disabled:bg-paper-deep disabled:text-ink-muted",
          error ? "border-error" : "border-border",
          className
        )}
        {...props}
      />
      {error ? (
        <p className="font-body text-[12.5px] text-error">{error}</p>
      ) : hint ? (
        <p className="font-body text-[12.5px] text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
});

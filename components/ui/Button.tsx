import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-sap text-white hover:bg-sap-hover",
  secondary: "bg-transparent text-canopy border border-canopy hover:bg-canopy hover:text-white",
  ghost: "bg-transparent text-ink hover:bg-paper-deep",
  destructive: "bg-transparent text-error border border-error hover:bg-error hover:text-white",
};

// Соответствует Tamga_Green_Design_Tokens.md и живому style guide (tamga_green_design_system.html):
// radius-md, состояния default/hover/disabled/loading.
export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold font-body transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        loading && "relative text-transparent pointer-events-none",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {children}
      {loading && (
        <span
          className="absolute h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden
        />
      )}
    </button>
  );
}

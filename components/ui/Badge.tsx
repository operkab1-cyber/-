import { cn } from "@/lib/cn";

interface BadgeProps {
  tone?: "sprout" | "stamp" | "error" | "muted";
  children: React.ReactNode;
}

const TONE_CLASSES: Record<NonNullable<BadgeProps["tone"]>, string> = {
  sprout: "bg-sprout-bg text-canopy",
  stamp: "bg-stamp-bg text-stamp-dark",
  error: "bg-error-bg text-error",
  muted: "bg-paper-deep text-ink-muted",
};

export function Badge({ tone = "muted", children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px]",
        TONE_CLASSES[tone]
      )}
    >
      {children}
    </span>
  );
}

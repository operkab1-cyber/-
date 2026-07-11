"use client";

import { useEffect, useState } from "react";
import { toggleCompare, isInCompare, subscribeCompare, type CompareItem } from "@/lib/compare";

export function CompareToggle({ plant, compact = false }: { plant: CompareItem; compact?: boolean }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActive(isInCompare(plant.id));
    return subscribeCompare(() => setActive(isInCompare(plant.id)));
  }, [plant.id]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleCompare(plant);
    if (!result.ok) {
      setError(result.error ?? null);
      setTimeout(() => setError(null), 3000);
      return;
    }
    setActive(isInCompare(plant.id));
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleClick}
          aria-pressed={active}
          title="Сравнить"
          className={
            "flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[12px] transition-colors " +
            (active ? "border-sap bg-sap text-white" : "border-border bg-white/90 text-ink-muted hover:bg-paper-deep")
          }
        >
          ⇄
        </button>
        {error && (
          <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-sm border border-error bg-error-bg px-2 py-1.5 font-body text-[11.5px] text-error shadow-md">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-pressed={active}
        title="Добавить к сравнению"
        className={
          "flex h-full items-center gap-1.5 rounded-md border px-4 py-3 font-body text-sm font-semibold transition-colors " +
          (active ? "border-sap bg-sprout-bg text-canopy" : "border-border bg-white text-ink hover:bg-paper-deep")
        }
      >
        {active ? "✓ Сравнить" : "Сравнить"}
      </button>
      {error && (
        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-sm border border-error bg-error-bg px-2 py-1.5 font-body text-[12px] text-error shadow-md">
          {error}
        </div>
      )}
    </div>
  );
}

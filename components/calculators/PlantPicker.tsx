"use client";

import { useState } from "react";
import { searchPlantsForCalculator } from "@/lib/actions/catalog";
import type { CatalogPlant } from "@/lib/queries/catalog";

export function PlantPicker({ locale, onSelect, selected }: { locale: string; onSelect: (p: CatalogPlant) => void; selected: CatalogPlant | null }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogPlant[]>([]);
  const [pending, setPending] = useState(false);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setPending(true);
    const found = await searchPlantsForCalculator(q, locale);
    setPending(false);
    setResults(found);
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border border-sap bg-sprout-bg px-3 py-2">
        <span className="font-body text-[13.5px] text-canopy">{selected.name}</span>
        <button type="button" onClick={() => onSelect(null as unknown as CatalogPlant)} className="font-body text-[12px] text-ink-muted underline">
          Изменить
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Найти растение по названию…"
        className="w-full rounded-sm border border-border px-3 py-2 font-body text-[13.5px]"
      />
      {pending && <p className="mt-1 font-body text-[12px] text-ink-muted">Ищем…</p>}
      {results.length > 0 && (
        <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-white shadow-md">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r)}
              className="block w-full px-3 py-2 text-left font-body text-[13px] text-ink hover:bg-paper-deep"
            >
              {r.name} {r.priceFrom && <span className="font-mono text-ink-muted">— от {r.priceFrom.toLocaleString("ru-RU")} {r.currency}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

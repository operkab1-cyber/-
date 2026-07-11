"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";

// Plant Catalog §4 / UX Bible §7.2 — фильтры слева (desktop). Полный набор
// динамических фильтров по attributes.is_filterable — backlog (сейчас реализован
// сквозной набор: наличие, форма кроны, цена — Plant Catalog §4.2 "обязательные
// сквозные фильтры", плюс один демонстрационный EAV-фильтр crown_form).
export function CatalogFiltersPanel({
  current,
}: {
  current: { instock?: string; crown_form?: string; min_price?: string; max_price?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(current as Record<string, string>);
    if (value === null) params.delete(key);
    else params.set(key, value);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <aside className={"h-max rounded-lg border border-border bg-white p-4 " + (isPending ? "opacity-60" : "")}>
      <p className="mb-3 font-body text-[13px] font-semibold text-ink">Фильтры</p>

      <label className="flex items-center gap-2 font-body text-[13.5px] text-ink">
        <input
          type="checkbox"
          checked={current.instock === "1"}
          onChange={(e) => updateParam("instock", e.target.checked ? "1" : null)}
        />
        Только в наличии
      </label>

      <div className="mt-4">
        <p className="mb-1.5 font-body text-[13px] font-semibold text-ink">Форма кроны</p>
        <select
          value={current.crown_form ?? ""}
          onChange={(e) => updateParam("crown_form", e.target.value || null)}
          className="w-full rounded-sm border border-border px-2 py-1.5 font-body text-[13px]"
        >
          <option value="">Любая</option>
          <option value="bush">Кустовая</option>
          <option value="standard">Штамбовая</option>
        </select>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 font-body text-[13px] font-semibold text-ink">Цена, KGS</p>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="от"
            defaultValue={current.min_price}
            onBlur={(e) => updateParam("min_price", e.target.value || null)}
            className="w-full rounded-sm border border-border px-2 py-1.5 font-mono text-[12.5px]"
          />
          <input
            type="number"
            placeholder="до"
            defaultValue={current.max_price}
            onBlur={(e) => updateParam("max_price", e.target.value || null)}
            className="w-full rounded-sm border border-border px-2 py-1.5 font-mono text-[12.5px]"
          />
        </div>
      </div>

      {(current.instock || current.crown_form || current.min_price || current.max_price) && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="mt-4 font-body text-[12.5px] text-ink-muted underline"
        >
          Сбросить фильтры
        </button>
      )}
    </aside>
  );
}

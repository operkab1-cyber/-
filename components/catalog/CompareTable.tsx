"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCompareItems, clearCompare, subscribeCompare } from "@/lib/compare";
import { fetchPlantsForCompare } from "@/lib/actions/catalog";
import { ATTRIBUTE_LABELS, formatAttributeValue } from "@/lib/attributeLabels";
import { Button } from "@/components/ui/Button";
import type { PlantDetail } from "@/lib/queries/catalog";

const ATTRIBUTE_CODES = ["hardiness_zone", "light", "height_range", "foliage_type", "container_volume", "crown_form"];

// Plant Catalog §6.2 — таблица сравнения: столбцы товары, строки характеристики,
// различающиеся значения подсвечены.
export function CompareTable({ locale }: { locale: string }) {
  const [plants, setPlants] = useState<PlantDetail[] | null>(null);

  useEffect(() => {
    async function load() {
      const items = getCompareItems();
      if (items.length === 0) {
        setPlants([]);
        return;
      }
      const data = await fetchPlantsForCompare(
        items.map((i) => i.id),
        locale
      );
      setPlants(data);
    }
    load();
    return subscribeCompare(load);
  }, [locale]);

  if (plants === null) {
    return <div className="animate-pulse text-ink-muted">Загрузка…</div>;
  }

  if (plants.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
        Список сравнения пуст. Добавьте товары со страницы каталога кнопкой «Сравнить».
        <div className="mt-4">
          <Link href={`/${locale}/catalog`} className="underline">
            Перейти в каталог
          </Link>
        </div>
      </div>
    );
  }

  function valuesDiffer(code: string): boolean {
    if (!plants) return false;
    const values = plants.map((p) => p.attributes.find((a) => a.code === code)?.value ?? "");
    return new Set(values).size > 1;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="ghost" onClick={clearCompare}>
          Очистить сравнение
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full font-body text-[13.5px]">
          <thead>
            <tr className="border-b border-border">
              <th className="w-40 p-3 text-left text-ink-muted">Характеристика</th>
              {plants.map((p) => (
                <th key={p.id} className="p-3 text-left">
                  <Link href={`/${locale}/catalog/${p.category?.slug ?? ""}/${p.slug}`} className="font-semibold text-canopy underline">
                    {p.name}
                  </Link>
                  {p.latinName && <div className="font-body text-[12px] italic text-ink-muted">{p.latinName}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-dashed border-border">
              <td className="p-3 text-ink-muted">Цена от</td>
              {plants.map((p) => (
                <td key={p.id} className="p-3 font-mono">
                  {p.priceTiers[0] ? `${p.priceTiers[0].price.toLocaleString("ru-RU")} ${p.priceTiers[0].currency}` : "—"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-dashed border-border">
              <td className="p-3 text-ink-muted">Поставщик</td>
              {plants.map((p) => (
                <td key={p.id} className="p-3">
                  {p.company?.name ?? "—"}
                </td>
              ))}
            </tr>
            {ATTRIBUTE_CODES.map((code) => (
              <tr
                key={code}
                className={"border-b border-dashed border-border last:border-none " + (valuesDiffer(code) ? "bg-stamp-bg" : "")}
              >
                <td className="p-3 text-ink-muted">{ATTRIBUTE_LABELS[code]}</td>
                {plants.map((p) => {
                  const attr = p.attributes.find((a) => a.code === code);
                  return (
                    <td key={p.id} className="p-3">
                      {attr ? formatAttributeValue(code, attr.value) : "уточняется"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-body text-[12.5px] text-ink-muted">
        Экспорт в PDF и публичная ссылка на сравнение — Plant Catalog §10, backlog (не входит в MVP Phase 3).
      </p>
    </div>
  );
}

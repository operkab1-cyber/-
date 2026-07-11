"use client";

import { useState } from "react";
import { PlantPicker } from "./PlantPicker";
import { addToCart } from "@/lib/actions/cart";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import type { CatalogPlant } from "@/lib/queries/catalog";

type PlantingType = "hedge" | "bed" | "roof";

// UX Bible §9.2 / AI Architecture §12 — калькулятор объёма для проекта.
// "LLM не считает" (§2.2): количество — чистая формула, не AI. Разбор свободного
// текста на входе ("участок примерно 6 соток, забор буквой Г") — AI-часть, не
// реализована без API-ключа (см. TODO.md) — вход тут строго структурированный.
export function VolumeCalculator({ locale }: { locale: string }) {
  const [type, setType] = useState<PlantingType>("hedge");
  const [length, setLength] = useState(10);
  const [density, setDensity] = useState(3); // растений на метр (изгородь) или на м² (клумба/кровля)
  const [plant, setPlant] = useState<CatalogPlant | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recommendedQty = Math.ceil(length * density);

  async function handleAddToCart() {
    if (!plant) return;
    setPending(true);
    setError(null);
    const result = await addToCart(plant.id, recommendedQty, locale);
    setPending(false);
    if (result.error) setError(result.error);
    else setAdded(true);
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select label="Тип посадки" value={type} onChange={(e) => setType(e.target.value as PlantingType)}>
          <option value="hedge">Живая изгородь</option>
          <option value="bed">Клумба</option>
          <option value="roof">Озеленение кровли</option>
        </Select>
        <TextField
          label={type === "hedge" ? "Длина, м" : "Площадь, м²"}
          type="number"
          value={length}
          onChange={(e) => setLength(Number(e.target.value) || 0)}
        />
        <TextField
          label={type === "hedge" ? "Плотность, раст./м" : "Плотность, раст./м²"}
          type="number"
          value={density}
          onChange={(e) => setDensity(Number(e.target.value) || 0)}
        />
      </div>

      <div className="mt-4 rounded-md bg-paper-deep p-4 text-center">
        <p className="font-body text-[13px] text-ink-muted">Рекомендованное количество</p>
        <p className="font-display text-3xl font-semibold text-canopy">{recommendedQty} шт</p>
      </div>

      <div className="mt-4">
        <p className="mb-2 font-body text-[13px] font-semibold text-ink">Растение для расчёта</p>
        <PlantPicker locale={locale} onSelect={setPlant} selected={plant} />
      </div>

      {plant && (
        <div className="mt-4">
          {added ? (
            <p className="font-body text-[13.5px] text-sap">✓ {recommendedQty} шт добавлено в корзину</p>
          ) : (
            <Button loading={pending} onClick={handleAddToCart}>
              Добавить {recommendedQty} шт в корзину
            </Button>
          )}
          {error && <p className="mt-2 font-body text-[12.5px] text-error">{error}</p>}
        </div>
      )}
    </div>
  );
}

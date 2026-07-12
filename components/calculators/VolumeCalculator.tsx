"use client";

import { useState } from "react";
import { PlantPicker } from "./PlantPicker";
import { addToCart } from "@/lib/actions/cart";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { parseGardenText } from "@/lib/ai/parseGardenText";
import type { CatalogPlant } from "@/lib/queries/catalog";

type PlantingType = "hedge" | "bed" | "roof";

// UX Bible §9.2 / AI Architecture §12 — калькулятор объёма для проекта.
// "LLM не считает" (§2.2): количество — чистая формула, не AI. Разбор свободного
// текста на входе ("участок примерно 6 соток, забор буквой Г") — AI-часть,
// в полном виде (в т.ч. геометрия участка "буквой Г") требует реального LLM
// без ANTHROPIC_API_KEY (см. TODO.md), поэтому здесь — Шаг 1 того же пайплайна,
// что и парсинг названий растений (Phase 3): детерминированный regex-разбор
// площади/длины/типа посадки (lib/ai/parseGardenText.ts), честно подписанный
// в интерфейсе как "быстрый ввод текстом", а не как AI-функция.
export function VolumeCalculator({ locale }: { locale: string }) {
  const [type, setType] = useState<PlantingType>("hedge");
  const [length, setLength] = useState(10);
  const [density, setDensity] = useState(3); // растений на метр (изгородь) или на м² (клумба/кровля)
  const [plant, setPlant] = useState<CatalogPlant | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [freeText, setFreeText] = useState("");
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseGardenText> | null>(null);

  function handleParse() {
    const result = parseGardenText(freeText);
    setParseResult(result);
    if (result.type) setType(result.type);
    if (result.length != null) setLength(result.length);
  }

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
      <div className="mb-4 rounded-md border border-dashed border-stamp bg-stamp-bg p-3">
        <p className="mb-1.5 font-body text-[12.5px] font-semibold text-stamp-dark">
          Быстрый ввод текстом <span className="font-normal text-ink-muted">(распознаёт площадь/длину и тип посадки по ключевым словам — не AI, проверьте результат)</span>
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="например: живая изгородь, 40 метров"
            className="w-full rounded-sm border border-border bg-white px-3 py-2 font-body text-[13.5px]"
          />
          <Button type="button" variant="secondary" onClick={handleParse}>
            Распознать
          </Button>
        </div>
        {parseResult && (
          <div className="mt-2 font-body text-[12px]">
            {parseResult.matched.length > 0 && (
              <p className="text-sap">Распознано: {parseResult.matched.join("; ")}.</p>
            )}
            {parseResult.unmatched.length > 0 && (
              <p className="text-ink-muted">Не распознано: {parseResult.unmatched.join("; ")}.</p>
            )}
            {parseResult.matched.length === 0 && parseResult.unmatched.length === 0 && (
              <p className="text-ink-muted">Ничего не найдено — заполните поля вручную.</p>
            )}
          </div>
        )}
      </div>

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

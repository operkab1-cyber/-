"use client";

import { useEffect, useState } from "react";
import { PlantPicker } from "./PlantPicker";
import { fetchPlantsForCompare } from "@/lib/actions/catalog";
import { addToCart } from "@/lib/actions/cart";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import type { CatalogPlant, PlantDetail } from "@/lib/queries/catalog";

// UX Bible §9.3 — калькулятор экономии при опте. Формула сравнивает ступени
// prices (детерминированно); AI — только объяснение результата естественным
// языком в чате (AI-помощник, не реализован здесь без API-ключа, см. TODO.md).
export function SavingsCalculator({ locale }: { locale: string }) {
  const [plant, setPlant] = useState<CatalogPlant | null>(null);
  const [detail, setDetail] = useState<PlantDetail | null>(null);
  const [qty, setQty] = useState(10);
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plant) {
      setDetail(null);
      return;
    }
    fetchPlantsForCompare([plant.id], locale).then((r) => setDetail(r[0] ?? null));
  }, [plant, locale]);

  const currentTier = detail
    ? [...detail.priceTiers].sort((a, b) => a.minQty - b.minQty).filter((t) => t.minQty <= qty).pop()
    : null;
  const nextTier = detail
    ? [...detail.priceTiers].sort((a, b) => a.minQty - b.minQty).find((t) => t.minQty > qty)
    : null;
  const savingsPercent =
    currentTier && nextTier ? Math.round((1 - nextTier.price / currentTier.price) * 100) : null;

  async function handleAddToCart() {
    if (!plant) return;
    setPending(true);
    setError(null);
    const result = await addToCart(plant.id, qty, locale);
    setPending(false);
    if (result.error) setError(result.error);
    else setAdded(true);
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="mb-2 font-body text-[13px] font-semibold text-ink">Растение</p>
      <PlantPicker locale={locale} onSelect={setPlant} selected={plant} />

      {detail && (
        <>
          <div className="mt-4">
            <TextField label="Желаемое количество" type="number" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} />
          </div>

          <table className="mt-4 w-full font-mono text-[13px]">
            <tbody>
              {[...detail.priceTiers]
                .sort((a, b) => a.minQty - b.minQty)
                .map((tier) => (
                  <tr
                    key={tier.minQty}
                    className={
                      "border-b border-dashed border-border last:border-none " +
                      (tier.minQty === currentTier?.minQty ? "bg-sprout-bg" : "")
                    }
                  >
                    <td className="py-1.5 text-ink-muted">от {tier.minQty} шт</td>
                    <td className="py-1.5 text-right text-ink">
                      {tier.price.toLocaleString("ru-RU")} {tier.currency}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {nextTier && savingsPercent !== null && savingsPercent > 0 && (
            <div className="mt-3 rounded-sm bg-stamp-bg px-3 py-2 font-body text-[13px] text-stamp-dark">
              Если возьмёте на {nextTier.minQty - qty} шт больше (всего {nextTier.minQty}) — цена за
              единицу упадёт на {savingsPercent}%.
            </div>
          )}

          <div className="mt-4">
            {added ? (
              <p className="font-body text-[13.5px] text-sap">✓ {qty} шт добавлено в корзину</p>
            ) : (
              <Button loading={pending} onClick={handleAddToCart}>
                Добавить {qty} шт в корзину
              </Button>
            )}
            {error && <p className="mt-2 font-body text-[12.5px] text-error">{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/actions/cart";
import { Button } from "@/components/ui/Button";

// Plant Catalog §2 / UX Bible §7.3 — «В корзину» с выбором количества.
export function AddToCartForm({ plantId, locale, minOrderQty }: { plantId: string; locale: string; minOrderQty: number }) {
  const [qty, setQty] = useState(minOrderQty);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const router = useRouter();

  async function handleAdd() {
    setPending(true);
    setError(null);
    const result = await addToCart(plantId, qty, locale);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setAdded(true);
    router.refresh();
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="w-20 rounded-md border border-border px-2 py-3 text-center font-mono text-sm"
        />
        <Button type="button" onClick={handleAdd} loading={pending} className="flex-1">
          {added ? "✓ Добавлено" : "В корзину"}
        </Button>
      </div>
      {error && <p className="font-body text-[12.5px] text-error">{error}</p>}
    </div>
  );
}

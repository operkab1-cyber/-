"use client";

import { useState } from "react";
import { updatePlantStock } from "@/lib/actions/supplierCatalog";

// Admin Panel §5.1 — колонка "Остаток" редактируется инлайн прямо в списке.
export function InlineStockCell({ plantId, stock, locale }: { plantId: string; stock: number; locale: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(stock));
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function commit() {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      setEditing(false);
      return;
    }
    setPending(true);
    await updatePlantStock(plantId, num, locale);
    setPending(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        className="w-20 rounded-sm border border-stamp px-1.5 py-1 font-mono text-[13px]"
      />
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="font-mono text-[13px] text-ink hover:underline">
      {stock}
      {saved && <span className="ml-1 text-sap">✓</span>}
    </button>
  );
}

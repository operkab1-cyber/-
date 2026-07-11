"use client";

import { useState } from "react";
import { updatePlantPrice } from "@/lib/actions/supplierCatalog";

// Admin Panel §4.1 — клик делает строку редактируемой инлайн, сохранение по
// Enter/blur, мгновенный тост-подтверждение.
export function InlinePriceCell({ plantId, price, currency, locale }: { plantId: string; price: number | null; currency: string; locale: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(price ?? 0));
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function commit() {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      setEditing(false);
      return;
    }
    setPending(true);
    await updatePlantPrice(plantId, num, locale);
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
        className="w-24 rounded-sm border border-stamp px-1.5 py-1 font-mono text-[13px]"
      />
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="font-mono text-[13px] text-ink hover:underline">
      {price != null ? `${price.toLocaleString("ru-RU")} ${currency}` : "—"}
      {saved && <span className="ml-1 text-sap">✓</span>}
    </button>
  );
}

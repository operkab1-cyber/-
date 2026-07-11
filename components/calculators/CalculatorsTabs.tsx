"use client";

import { useState } from "react";
import { VolumeCalculator } from "./VolumeCalculator";
import { SavingsCalculator } from "./SavingsCalculator";
import { ShippingQuoteCalculator } from "./ShippingQuoteCalculator";

export function CalculatorsTabs({ locale }: { locale: string }) {
  const [tab, setTab] = useState<"volume" | "savings" | "shipping">("volume");

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("volume")}
          className={"rounded-full px-4 py-1.5 font-mono text-[12.5px] " + (tab === "volume" ? "bg-sap text-white" : "border border-border bg-white text-ink-muted")}
        >
          Объём для проекта
        </button>
        <button
          type="button"
          onClick={() => setTab("savings")}
          className={"rounded-full px-4 py-1.5 font-mono text-[12.5px] " + (tab === "savings" ? "bg-sap text-white" : "border border-border bg-white text-ink-muted")}
        >
          Экономия при опте
        </button>
        <button
          type="button"
          onClick={() => setTab("shipping")}
          className={"rounded-full px-4 py-1.5 font-mono text-[12.5px] " + (tab === "shipping" ? "bg-sap text-white" : "border border-border bg-white text-ink-muted")}
        >
          Доставка
        </button>
      </div>
      {tab === "volume" && <VolumeCalculator locale={locale} />}
      {tab === "savings" && <SavingsCalculator locale={locale} />}
      {tab === "shipping" && <ShippingQuoteCalculator />}
    </div>
  );
}

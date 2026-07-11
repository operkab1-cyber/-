"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface PriceTier {
  minQty: number;
  price: number;
  currency: string;
}

// Admin Panel §4.1: "Изменение сразу видно покупателям, стоящим на странице
// товара, через Realtime-канал (Этап 4, раздел 6.4)". `prices` уже публично
// читаема (RLS `public_read_prices` — using(true)), поэтому подписка на
// postgres_changes не требует дополнительной авторизации канала.
export function LivePriceTiers({ plantId, initialTiers }: { plantId: string; initialTiers: PriceTier[] }) {
  const [tiers, setTiers] = useState<PriceTier[]>(initialTiers);
  const [justUpdated, setJustUpdated] = useState(false);
  const isFirstRun = useRef(true);

  useEffect(() => {
    const supabase = createClient();

    async function refetch() {
      const { data } = await supabase
        .from("prices")
        .select("min_qty, price, currency")
        .eq("plant_id", plantId)
        .order("min_qty");
      if (!data) return;
      setTiers(data.map((t) => ({ minQty: t.min_qty, price: t.price, currency: t.currency })));
      if (!isFirstRun.current) {
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 2000);
      }
      isFirstRun.current = false;
    }

    const channel = supabase
      .channel(`prices:plant:${plantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prices", filter: `plant_id=eq.${plantId}` },
        () => refetch()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [plantId]);

  return (
    <table className={"w-full font-mono text-[13px] transition-colors duration-500 " + (justUpdated ? "bg-sprout-bg" : "")}>
      <tbody>
        {tiers.map((tier) => (
          <tr key={tier.minQty} className="border-b border-dashed border-border last:border-none">
            <td className="py-1.5 text-ink-muted">от {tier.minQty} шт</td>
            <td className="py-1.5 text-right text-ink">
              {tier.price.toLocaleString("ru-RU")} {tier.currency}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

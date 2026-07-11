"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCartItemQty, removeCartItem } from "@/lib/actions/cart";
import type { CartLineItem } from "@/lib/queries/cart";

export function CartItemRow({ item, locale }: { item: CartLineItem; locale: string }) {
  const [qty, setQty] = useState(item.qty);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function commitQty(newQty: number) {
    setQty(newQty);
    startTransition(async () => {
      await updateCartItemQty(item.itemId, newQty, locale);
      router.refresh();
    });
  }

  return (
    <div className={"flex items-center gap-4 border-b border-dashed border-border py-3 last:border-none " + (isPending ? "opacity-60" : "")}>
      <a href={`/${locale}/catalog/${item.categorySlug ?? ""}/${item.slug}`} className="flex-1 font-body text-[13.5px] text-ink hover:underline">
        {item.name}
      </a>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => commitQty(qty - 1)}
          className="h-7 w-7 rounded border border-border font-mono text-sm"
        >
          −
        </button>
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 0)}
          onBlur={() => commitQty(qty)}
          className="w-14 rounded border border-border text-center font-mono text-[13px]"
        />
        <button
          type="button"
          onClick={() => commitQty(qty + 1)}
          className="h-7 w-7 rounded border border-border font-mono text-sm"
        >
          +
        </button>
      </div>
      <span className="w-28 text-right font-mono text-[13px] text-ink">
        {(item.unitPrice * item.qty).toLocaleString("ru-RU")} {item.currency}
      </span>
      <button
        type="button"
        onClick={() => startTransition(async () => { await removeCartItem(item.itemId, locale); router.refresh(); })}
        className="font-body text-[12px] text-error underline"
      >
        Удалить
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getCompareItems, subscribeCompare, type CompareItem } from "@/lib/compare";

// Plant Catalog §6.1: "плавающая панель внизу экрана... доступна на любом экране
// каталога, пока список не пуст".
export function CompareBar({ locale }: { locale: string }) {
  const [items, setItems] = useState<CompareItem[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    setItems(getCompareItems());
    return subscribeCompare(() => setItems(getCompareItems()));
  }, []);

  if (items.length === 0) return null;
  if (pathname?.endsWith("/compare")) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-5 py-3 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {items.map((i) => (
            <span key={i.id} className="whitespace-nowrap rounded-full bg-paper-deep px-3 py-1 font-body text-[12.5px] text-ink">
              {i.name}
            </span>
          ))}
        </div>
        <a
          href={`/${locale}/compare`}
          className="whitespace-nowrap rounded-md bg-sap px-4 py-2 font-body text-sm font-semibold text-white hover:bg-sap-hover"
        >
          Сравнить ({items.length})
        </a>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { duplicatePlant } from "@/lib/actions/supplierCatalog";

// Admin Panel §3.2 — «Дублировать» на существующей карточке.
export function DuplicateButton({ plantId, locale }: { plantId: string; locale: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        duplicatePlant(plantId, locale);
      }}
      className="font-body text-[12px] text-ink-muted underline disabled:opacity-50"
    >
      Дублировать
    </button>
  );
}

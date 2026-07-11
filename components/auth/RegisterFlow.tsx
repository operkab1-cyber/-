"use client";

import { useState } from "react";
import { SupplierWizard } from "./SupplierWizard";
import { BuyerWizard } from "./BuyerWizard";

type Role = "supplier" | "buyer";

// Экран выбора роли — UX Bible §4.1: две крупные карточки, выбор определяет
// весь последующий флоу форм.
export function RegisterFlow({ locale }: { locale: string }) {
  const [role, setRole] = useState<Role | null>(null);

  if (role === "supplier") return <SupplierWizard locale={locale} onBack={() => setRole(null)} />;
  if (role === "buyer") return <BuyerWizard locale={locale} onBack={() => setRole(null)} />;

  return (
    <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
      <RoleCard
        title="Я поставщик"
        description="Продаю растения и товары для сада — питомник, оптовик."
        onClick={() => setRole("supplier")}
      />
      <RoleCard
        title="Я покупатель"
        description="Закупаю для садового центра или ландшафтных проектов."
        onClick={() => setRole("buyer")}
      />
    </div>
  );
}

function RoleCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-lg border border-border bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <h2 className="font-display text-xl font-semibold text-canopy">{title}</h2>
      <p className="font-body text-[14px] text-ink-muted">{description}</p>
    </button>
  );
}

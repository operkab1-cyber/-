import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { Badge } from "@/components/ui/Badge";

// Заглушка дашборда поставщика (UX Bible §5.1) — полноценные виджеты (новые заказы,
// график продаж, топ-товары) появятся вместе с Phase 4/5. Здесь — доказательство,
// что онбординг доводит до защищённого кабинета своей роли.
export default async function SupplierDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "supplier") redirect(`/${locale}/onboarding/status`);
  if (account.company?.verificationStatus !== "approved") redirect(`/${locale}/onboarding/status`);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-canopy">
          Кабинет поставщика — {account.company.name}
        </h1>
        <Badge tone="sprout">Верифицирован</Badge>
      </div>
      <p className="font-body text-[14px] text-ink-muted">
        Управление каталогом, заказами и аналитикой — Phase 4/5.
      </p>
    </main>
  );
}

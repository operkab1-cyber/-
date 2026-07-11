import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { Badge } from "@/components/ui/Badge";

// Заглушка дашборда покупателя (UX Bible §6.1) — активные заказы, рекомендации,
// избранные поставщики появятся вместе с Phase 3/4.
export default async function BuyerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "buyer") redirect(`/${locale}/onboarding/status`);
  if (account.company?.verificationStatus !== "approved") redirect(`/${locale}/onboarding/status`);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-canopy">
          Кабинет покупателя — {account.company.name}
        </h1>
        <Badge tone="sprout">Верифицирован</Badge>
      </div>
      <p className="font-body text-[14px] text-ink-muted">
        Заказы, избранное и калькуляторы — Phase 3/4.
      </p>
    </main>
  );
}

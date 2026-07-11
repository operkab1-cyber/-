import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/queries/account";
import { Badge } from "@/components/ui/Badge";

// UX Bible §5.1 — дашборд поставщика. Полноценные виджеты (график продаж,
// топ-товары на этой самой странице) — Phase 5 CMS/Analytics.
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
      <div className="flex flex-wrap gap-3">
        <Link href={`/${locale}/supplier/products`} className="rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink hover:bg-paper-deep">
          Каталог
        </Link>
        <Link href={`/${locale}/supplier/orders`} className="rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink hover:bg-paper-deep">
          Заказы
        </Link>
        <Link href={`/${locale}/supplier/analytics`} className="rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink hover:bg-paper-deep">
          Аналитика
        </Link>
      </div>
    </main>
  );
}

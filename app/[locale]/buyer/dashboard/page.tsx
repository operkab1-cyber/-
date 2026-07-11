import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/queries/account";
import { Badge } from "@/components/ui/Badge";

// UX Bible §6.1 — дашборд покупателя. Полные виджеты (рекомендации, избранные
// поставщики с индикатором новинок) — backlog; здесь быстрый доступ к тому, что
// уже реально работает (каталог, корзина, заказы).
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
      <div className="flex gap-3">
        <Link href={`/${locale}/catalog`} className="rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink hover:bg-paper-deep">
          Каталог
        </Link>
        <Link href={`/${locale}/buyer/cart`} className="rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink hover:bg-paper-deep">
          Корзина
        </Link>
        <Link href={`/${locale}/buyer/orders`} className="rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink hover:bg-paper-deep">
          Заказы
        </Link>
        <Link href={`/${locale}/buyer/calculators`} className="rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink hover:bg-paper-deep">
          Калькуляторы
        </Link>
      </div>
      <p className="mt-4 font-body text-[14px] text-ink-muted">
        Рекомендации, избранные поставщики — backlog.
      </p>
    </main>
  );
}

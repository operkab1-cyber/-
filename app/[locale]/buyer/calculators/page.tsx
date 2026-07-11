import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { CalculatorsTabs } from "@/components/calculators/CalculatorsTabs";

// UX Bible §9 — калькуляторы в кабинете покупателя (объём для проекта, экономия
// при опте). Калькулятор доставки (§9.1) — не реализован, требует интеграции
// с перевозчиком (Architecture §10.1, backlog). Калькулятор стоимости
// озеленения из landscaping_calculator.html — отдельная публичная страница,
// Phase 8.
export default async function CalculatorsPage({
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
    <main className="mx-auto max-w-[900px] px-5 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold text-canopy">Калькуляторы</h1>
      <CalculatorsTabs locale={locale} />
    </main>
  );
}

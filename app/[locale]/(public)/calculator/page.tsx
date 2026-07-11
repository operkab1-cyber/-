import type { Metadata } from "next";
import { getCalculatorCatalog } from "@/lib/queries/calculator";
import { LandscapingCalculator } from "@/components/calculator/LandscapingCalculator";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Калькулятор озеленения",
    description:
      "Быстрый расчёт стоимости озеленения участка: растения, газон, автополив, декоративная отсыпка. Заявка отправляется напрямую в WhatsApp.",
    alternates: {
      canonical: `/${locale}/calculator`,
      languages: { en: `/en/calculator`, ru: `/ru/calculator`, "x-default": `/en/calculator` },
    },
  };
}

// Rule 9 — публичная страница /calculator, порт landscaping_calculator.html.
export default async function CalculatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Деградация по тому же принципу, что и на главной (rule 9 не требует
  // хардкодить каталог обратно — просто показываем пустой калькулятор,
  // если БД временно недоступна).
  let catalog: Awaited<ReturnType<typeof getCalculatorCatalog>> = [];
  try {
    catalog = await getCalculatorCatalog(locale);
  } catch {
    // калькулятор отрендерится с пустым каталогом растений
  }

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <h1 className="mb-2 font-display text-3xl font-semibold text-canopy">Калькулятор озеленения</h1>
      <p className="mb-6 max-w-2xl font-body text-[14px] text-ink-muted">
        Соберите смету по своему участку: выберите растения из каталога, добавьте газон, автополив
        и декоративную отсыпку — заявка уйдёт напрямую в WhatsApp.
      </p>
      <LandscapingCalculator catalog={catalog} />
    </main>
  );
}

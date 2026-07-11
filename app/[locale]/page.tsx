import Link from "next/link";
import type { Metadata } from "next";
import { getTrustNumbers } from "@/lib/queries/home";
import { getPlantsByCategory, getCategoryTree } from "@/lib/queries/catalog";
import { ProductCard } from "@/components/catalog/ProductCard";
import { SearchBar } from "@/components/catalog/SearchBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildWebSiteJsonLd } from "@/lib/seo/jsonLd";

export const revalidate = 3600; // SSG+ISR — System Architecture §3

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    // [решено самостоятельно, найдено живым тестом] title.template в layout.tsx
    // НЕ применяется к app/[locale]/page.tsx — Next.js применяет template только
    // к дочерним сегментам относительно layout, а не к странице в том же сегменте.
    // Проверено вживую: /register (дочерний сегмент) корректно получает суффикс
    // "| Tamga Green", а сама /[locale]/page.tsx — нет, поэтому здесь бренд
    // указывается явно, а не полагается на template (в отличие от category/
    // product/supplier ниже по дереву, где template действительно работает).
    title: "Tamga Green — все питомники Европы в одном окне",
    description:
      "B2B-маркетплейс для питомников, садовых центров и ландшафтных компаний: прозрачные цены, остатки в реальном времени, проверенные поставщики.",
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", ru: "/ru", "x-default": "/en" },
    },
  };
}

// UX Bible §3.1 — главная страница.
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // "Если backend аналитики недоступен — статичные плейсхолдер-цифры вместо
  // ошибки на весь экран" (§3.1) — try/catch реализует именно это требование.
  let trust = { supplierCount: 0, plantCount: 0, countryCount: 0 };
  let previewPlants: Awaited<ReturnType<typeof getPlantsByCategory>> = [];
  try {
    trust = await getTrustNumbers();
    const tree = await getCategoryTree(locale);
    const firstTop = tree.find((c) => !c.parentId);
    if (firstTop) previewPlants = (await getPlantsByCategory(firstTop.slug, locale)).slice(0, 4);
  } catch {
    // деградация — секции ниже сами показывают дефолтные/пустые значения
  }

  return (
    <>
      <JsonLd data={buildWebSiteJsonLd()} />

      <header className="border-b border-border bg-white px-5 py-4">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <span className="font-display text-xl font-semibold text-canopy">Tamga Green</span>
          <nav className="flex items-center gap-4 font-body text-[13.5px] text-ink">
            <Link href={`/${locale}/catalog`}>Каталог</Link>
            <Link href={`/${locale}/login`}>Войти</Link>
            <Link href={`/${locale}/register`} className="rounded-md bg-sap px-4 py-2 font-semibold text-white hover:bg-sap-hover">
              Регистрация
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="bg-canopy px-5 py-16 text-center text-white">
          <h1 className="mx-auto max-w-2xl font-display text-4xl font-semibold">
            Все питомники Европы — в одном окне
          </h1>
          <p className="mx-auto mt-3 max-w-xl font-body text-[16px] text-paper/80">
            Прозрачные цены, остатки в реальном времени, проверенные поставщики. Для питомников,
            садовых центров и ландшафтных компаний.
          </p>
          <div className="mx-auto mt-6 flex max-w-md gap-3">
            <Link
              href={`/${locale}/register`}
              className="flex-1 rounded-md bg-sap px-5 py-3 font-body text-sm font-semibold text-white hover:bg-sap-hover"
            >
              Я поставщик
            </Link>
            <Link
              href={`/${locale}/register`}
              className="flex-1 rounded-md border border-white/40 px-5 py-3 font-body text-sm font-semibold text-white hover:bg-white/10"
            >
              Я покупатель
            </Link>
          </div>
          <div className="mx-auto mt-6 max-w-md">
            <SearchBar locale={locale} />
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-5 py-10">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-display text-3xl font-semibold text-canopy">{trust.supplierCount || "—"}</p>
              <p className="font-body text-[13px] text-ink-muted">поставщиков</p>
            </div>
            <div>
              <p className="font-display text-3xl font-semibold text-canopy">{trust.plantCount || "—"}</p>
              <p className="font-body text-[13px] text-ink-muted">товаров в каталоге</p>
            </div>
            <div>
              <p className="font-display text-3xl font-semibold text-canopy">{trust.countryCount || "—"}</p>
              <p className="font-body text-[13px] text-ink-muted">стран</p>
            </div>
          </div>
        </section>

        <section className="bg-paper-deep px-5 py-10">
          <div className="mx-auto max-w-[1280px]">
            <h2 className="mb-6 text-center font-display text-2xl font-semibold text-canopy">Как это работает</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <Step n={1} title="Регистрация" text="Заполните профиль компании и загрузите документы на проверку." />
              <Step n={2} title="Верификация" text="Обычно занимает 24–48 часов." />
              <Step n={3} title="Первая сделка" text="Публикуйте каталог или оформляйте заказ у проверенных поставщиков." />
            </div>
          </div>
        </section>

        {previewPlants.length > 0 && (
          <section className="mx-auto max-w-[1280px] px-5 py-10">
            <h2 className="mb-6 font-display text-2xl font-semibold text-canopy">Из каталога</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {previewPlants.map((plant) => (
                <ProductCard key={plant.id} plant={plant} locale={locale} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border bg-white px-5 py-8 text-center font-body text-[12.5px] text-ink-muted">
        Tamga Green — цифровая инфраструктура для европейской индустрии садовых центров.
      </footer>
    </>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <span className="font-mono text-[12px] text-stamp">Шаг {n}</span>
      <h3 className="mt-1 font-display text-lg font-semibold text-canopy">{title}</h3>
      <p className="mt-1 font-body text-[13.5px] text-ink-muted">{text}</p>
    </div>
  );
}

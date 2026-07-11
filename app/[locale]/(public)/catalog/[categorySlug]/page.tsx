import Link from "next/link";
import { getPlantsByCategory, resolveCategoryBySlug, type CatalogFilters } from "@/lib/queries/catalog";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CatalogFiltersPanel } from "@/components/catalog/CatalogFiltersPanel";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildCollectionPageJsonLd, buildBreadcrumbJsonLd } from "@/lib/seo/jsonLd";

export const revalidate = 120; // ISR: см. Tamga_Green_System_Architecture.md, раздел 3

interface Props {
  params: Promise<{ locale: string; categorySlug: string }>;
  searchParams: Promise<{ instock?: string; crown_form?: string; min_price?: string; max_price?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, categorySlug } = await params;
  const category = await resolveCategoryBySlug(categorySlug, locale);
  const name = category?.name ?? categorySlug;
  // Суффикс "| Tamga Green" не дублируется здесь — его добавляет template в
  // корневом layout.tsx (title: { template: "%s | Tamga Green" }).
  const title = `${name} — купить у проверенных питомников`;
  return {
    title,
    description: `Каталог категории «${name}»: сравните цену и наличие у верифицированных поставщиков.`,
    alternates: {
      canonical: `/${locale}/catalog/${categorySlug}`,
      languages: { en: `/en/catalog/${categorySlug}`, ru: `/ru/catalog/${categorySlug}`, "x-default": `/en/catalog/${categorySlug}` },
    },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, categorySlug } = await params;
  const sp = await searchParams;

  const category = await resolveCategoryBySlug(categorySlug, locale);
  if (!category) notFound();

  const filters: CatalogFilters = {
    inStockOnly: sp.instock === "1",
    crownForm: sp.crown_form,
    minPrice: sp.min_price ? Number(sp.min_price) : undefined,
    maxPrice: sp.max_price ? Number(sp.max_price) : undefined,
  };

  const plants = await getPlantsByCategory(categorySlug, locale, filters);

  const breadcrumbItems = [
    { name: "Каталог", url: `/${locale}/catalog` },
    ...category.breadcrumbs.map((b) => ({ name: b.name, url: `/${locale}/catalog/${b.slug}` })),
  ];

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <JsonLd data={buildCollectionPageJsonLd({ name: category.name, url: `/${locale}/catalog/${categorySlug}`, itemNames: plants.map((p) => p.name) })} />
      <JsonLd data={buildBreadcrumbJsonLd(breadcrumbItems)} />
      <nav className="mb-4 font-mono text-xs text-ink-muted">
        <Link href={`/${locale}/catalog`}>Каталог</Link>
        {category.breadcrumbs.map((b) => (
          <span key={b.id}>
            {" / "}
            <Link href={`/${locale}/catalog/${b.slug}`}>{b.name}</Link>
          </span>
        ))}
      </nav>

      <h1 className="mb-2 font-display text-3xl font-semibold text-canopy">
        {category.name} <span className="font-mono text-base text-ink-muted">({plants.length})</span>
      </h1>

      {category.children.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {category.children.map((c) => (
            <Link
              key={c.id}
              href={`/${locale}/catalog/${c.slug}`}
              className="rounded-full border border-border bg-white px-3.5 py-1.5 font-body text-[13px] text-ink hover:border-sap hover:text-sap"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <CatalogFiltersPanel current={sp} />

        <div>
          {plants.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
              По вашему запросу ничего не найдено.
              <div className="mt-3">
                <Link href={`/${locale}/catalog/${categorySlug}`} className="underline">
                  Сбросить фильтры
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plants.map((plant) => (
                <ProductCard key={plant.id} plant={plant} categorySlug={categorySlug} locale={locale} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

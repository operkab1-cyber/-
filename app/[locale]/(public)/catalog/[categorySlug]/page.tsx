import { getPlantsByCategory, getCategories } from "@/lib/queries/catalog";
import { ProductCard } from "@/components/catalog/ProductCard";
import type { Metadata } from "next";

export const revalidate = 120; // ISR: см. Tamga_Green_System_Architecture.md, раздел 3

interface Props {
  params: Promise<{ locale: string; categorySlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, categorySlug } = await params;
  const categories = await getCategories(locale);
  const category = categories.find((c) => c.slug === categorySlug);
  const name = category?.name ?? categorySlug;
  const title = `${name} — купить у проверенных питомников | Tamga Green`;
  return {
    title,
    description: `Каталог категории «${name}»: сравните цену и наличие у верифицированных поставщиков.`,
    alternates: { canonical: `/catalog/${categorySlug}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { locale, categorySlug } = await params;
  const [plants, categories] = await Promise.all([
    getPlantsByCategory(categorySlug, locale),
    getCategories(locale),
  ]);
  const category = categories.find((c) => c.slug === categorySlug);
  const categoryName = category?.name ?? categorySlug;

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <nav className="mb-4 font-mono text-xs text-ink-muted">
        <a href={`/${locale}/catalog`}>Каталог</a> / {categoryName}
      </nav>
      <h1 className="mb-6 font-display text-3xl font-semibold text-canopy">
        {categoryName} <span className="font-mono text-base text-ink-muted">({plants.length})</span>
      </h1>

      {plants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
          В этой категории пока нет опубликованных товаров.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plants.map((plant) => (
            <ProductCard key={plant.id} plant={plant} categorySlug={categorySlug} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}

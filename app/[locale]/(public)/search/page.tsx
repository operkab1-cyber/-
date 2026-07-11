import { searchPlants } from "@/lib/queries/catalog";
import { SearchBar } from "@/components/catalog/SearchBar";
import { ProductCard } from "@/components/catalog/ProductCard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Поиск" };

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const plants = query ? await searchPlants(query, locale) : [];

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <h1 className="mb-4 font-display text-2xl font-semibold text-canopy">Поиск</h1>
      <div className="mb-6 max-w-md">
        <SearchBar locale={locale} defaultValue={query} />
      </div>

      {!query ? (
        <p className="text-ink-muted">Введите запрос — например, «туя» или «Thuja».</p>
      ) : plants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
          По запросу «{query}» ничего не найдено. Попробуйте другое название или проверьте написание.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {plants.map((plant) => (
            <ProductCard key={plant.id} plant={plant} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}

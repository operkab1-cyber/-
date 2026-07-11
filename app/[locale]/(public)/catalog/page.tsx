import Link from "next/link";
import { getCategoryTree } from "@/lib/queries/catalog";
import { SearchBar } from "@/components/catalog/SearchBar";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = { title: "Каталог" };

export default async function CatalogIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tree = await getCategoryTree(locale);
  const topLevel = tree.filter((c) => !c.parentId);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <h1 className="mb-4 font-display text-3xl font-semibold text-canopy">Каталог</h1>
      <div className="mb-8 max-w-md">
        <SearchBar locale={locale} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {topLevel.map((category) => {
          const children = tree.filter((c) => c.parentId === category.id);
          return (
            <Link
              key={category.id}
              href={`/${locale}/catalog/${category.slug}`}
              className="rounded-lg border border-border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="font-display text-lg font-semibold text-canopy">{category.name}</h2>
              <p className="mt-1 font-body text-[12.5px] text-ink-muted">
                {children.map((c) => c.name).join(", ")}
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

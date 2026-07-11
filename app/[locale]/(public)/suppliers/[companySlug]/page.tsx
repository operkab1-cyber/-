import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupplierBySlug } from "@/lib/queries/supplier";
import { getPlantsByCompany } from "@/lib/queries/catalog";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Badge } from "@/components/ui/Badge";
import { JsonLd } from "@/components/seo/JsonLd";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string; companySlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, companySlug } = await params;
  const supplier = await getSupplierBySlug(companySlug);
  if (!supplier) return {};
  return {
    // Суффикс "| Tamga Green" добавляет template в корневом layout.tsx, не дублируем здесь.
    title: `${supplier.name} — ${supplier.country}`,
    description: supplier.description ?? `${supplier.name}: каталог товаров на Tamga Green.`,
    alternates: {
      canonical: `/${locale}/suppliers/${companySlug}`,
      languages: { en: `/en/suppliers/${companySlug}`, ru: `/ru/suppliers/${companySlug}`, "x-default": `/en/suppliers/${companySlug}` },
    },
  };
}

// SEO Strategy §2 — профиль поставщика: Organization + AggregateRating.
export default async function SupplierPage({ params }: Props) {
  const { locale, companySlug } = await params;
  const supplier = await getSupplierBySlug(companySlug);
  if (!supplier) notFound();

  const plants = await getPlantsByCompany(supplier.id, locale);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: supplier.name,
          address: { "@type": "PostalAddress", addressCountry: supplier.country },
          ...(supplier.ratingCount > 0 && {
            aggregateRating: { "@type": "AggregateRating", ratingValue: supplier.ratingAvg, reviewCount: supplier.ratingCount },
          }),
        }}
      />

      <div className="mb-6 flex items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-canopy">{supplier.name}</h1>
        <Badge tone="stamp">Верифицирован</Badge>
        <span className="font-mono text-[12.5px] text-ink-muted">{supplier.country}</span>
      </div>
      {supplier.description && <p className="mb-6 max-w-2xl font-body text-[14px] text-ink-muted">{supplier.description}</p>}

      <h2 className="mb-4 font-display text-xl font-semibold text-canopy">Каталог ({plants.length})</h2>
      {plants.length === 0 ? (
        <p className="font-body text-[13.5px] text-ink-muted">Пока нет опубликованных товаров.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plants.map((plant) => (
            <ProductCard key={plant.id} plant={plant} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}

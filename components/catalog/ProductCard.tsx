import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { CompareToggle } from "@/components/catalog/CompareToggle";
import type { CatalogPlant } from "@/lib/queries/catalog";

export function ProductCard({
  plant,
  categorySlug,
  locale,
}: {
  plant: CatalogPlant;
  categorySlug?: string;
  locale: string;
}) {
  const resolvedCategorySlug = plant.categorySlug ?? categorySlug ?? "";
  return (
    <Link
      href={`/${locale}/catalog/${resolvedCategorySlug}/${plant.slug}`}
      className="group block overflow-hidden rounded-lg border border-border bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="relative h-40 bg-gradient-to-br from-sprout to-sap">
        {plant.coverImage && (
          <Image
            src={plant.coverImage}
            alt={plant.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 25vw"
          />
        )}
        <div className="absolute right-2 top-2 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          <CompareToggle compact plant={{ id: plant.id, slug: plant.slug, name: plant.name, categorySlug: resolvedCategorySlug }} />
        </div>
      </div>
      <div className="relative border-t border-dashed border-border px-4 py-4 pl-6">
        <span
          className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border border-border bg-paper"
          aria-hidden
        />
        <h3 className="font-display text-[17px] font-semibold text-ink">{plant.name}</h3>
        {plant.latinName && (
          <p className="mt-0.5 font-body text-[12.5px] italic text-ink-muted">{plant.latinName}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[13px] text-ink">
            {plant.priceFrom ? `от ${plant.priceFrom.toLocaleString("ru-RU")} ${plant.currency}` : "цена по запросу"}
          </span>
          <Badge tone={plant.inStock ? "sprout" : "error"}>
            {plant.inStock ? "В наличии" : "Нет в наличии"}
          </Badge>
        </div>
      </div>
    </Link>
  );
}

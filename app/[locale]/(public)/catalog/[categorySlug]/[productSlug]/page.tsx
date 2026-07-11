import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { getPlantBySlug, getCompatiblePlants } from "@/lib/queries/catalog";
import { Badge } from "@/components/ui/Badge";
import { RequestForm } from "@/components/catalog/RequestForm";
import { CompareToggle } from "@/components/catalog/CompareToggle";
import { AddToCartForm } from "@/components/catalog/AddToCartForm";
import { ATTRIBUTE_LABELS, formatAttributeValue } from "@/lib/attributeLabels";
import Link from "next/link";

export const revalidate = 120; // ISR — System Architecture §3

interface Props {
  params: Promise<{ locale: string; categorySlug: string; productSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productSlug, locale } = await params;
  const plant = await getPlantBySlug(productSlug, locale);
  if (!plant) return {};
  const cheapestTier = plant.priceTiers[0];
  const title = cheapestTier
    ? `${plant.name} — купить от ${cheapestTier.price} ${cheapestTier.currency} | Tamga Green`
    : `${plant.name} | Tamga Green`;
  return {
    title,
    description: plant.description ?? plant.name,
    alternates: { canonical: `/catalog/${plant.category?.slug ?? ""}/${plant.slug}` },
  };
}

// Plant Catalog §2 — карточка растения (страница товара).
export default async function ProductPage({ params }: Props) {
  const { locale, categorySlug, productSlug } = await params;
  const plant = await getPlantBySlug(productSlug, locale);
  if (!plant) notFound();

  const compatiblePlants = await getCompatiblePlants(plant.id, locale);
  const cover = plant.images.find((i) => i.isCover) ?? plant.images[0];
  const inStock = plant.totalStock > 0;

  const ALL_ATTRIBUTE_CODES = ["hardiness_zone", "light", "height_range", "foliage_type", "container_volume", "crown_form"];
  const valueByCode = new Map(plant.attributes.map((a) => [a.code, a]));

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <nav className="mb-4 font-mono text-xs text-ink-muted">
        <Link href={`/${locale}/catalog`}>Каталог</Link>
        {plant.category?.parentSlug && (
          <>
            {" / "}
            <Link href={`/${locale}/catalog/${plant.category.parentSlug}`}>{plant.category.parentSlug}</Link>
          </>
        )}
        {plant.category && (
          <>
            {" / "}
            <Link href={`/${locale}/catalog/${plant.category.slug}`}>{plant.category.name}</Link>
          </>
        )}
        {" / "}
        {plant.name}
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-gradient-to-br from-sprout to-sap">
          {cover && (
            <Image src={cover.filePath} alt={plant.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
          )}
        </div>

        <div>
          <h1 className="font-display text-3xl font-semibold text-canopy">{plant.name}</h1>
          {plant.latinName && <p className="mt-1 font-body text-[15px] italic text-ink-muted">{plant.latinName}</p>}

          {plant.company && (
            <div className="mt-3 flex items-center gap-2">
              <Link href={`/${locale}/suppliers/${plant.company.slug}`} className="font-body text-[13.5px] text-ink underline">
                {plant.company.name}
              </Link>
              <Badge tone="stamp">Верифицирован</Badge>
              <span className="font-mono text-[12px] text-ink-muted">{plant.company.country}</span>
            </div>
          )}

          <div className="mt-5 rounded-lg border border-border bg-white p-4">
            <p className="mb-2 font-body text-[13px] font-semibold text-ink">Цена по объёму</p>
            <table className="w-full font-mono text-[13px]">
              <tbody>
                {plant.priceTiers.map((tier) => (
                  <tr key={tier.minQty} className="border-b border-dashed border-border last:border-none">
                    <td className="py-1.5 text-ink-muted">от {tier.minQty} шт</td>
                    <td className="py-1.5 text-right text-ink">
                      {tier.price.toLocaleString("ru-RU")} {tier.currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center justify-between">
              <Badge tone={inStock ? "sprout" : "error"}>{inStock ? `В наличии: ${plant.totalStock}` : "Нет в наличии"}</Badge>
              {plant.stockUpdatedAt && (
                <span className="font-mono text-[11px] text-ink-muted">
                  обновлено {new Date(plant.stockUpdatedAt).toLocaleDateString("ru-RU")}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex gap-2">
              {inStock ? (
                <div className="flex-1">
                  <AddToCartForm plantId={plant.id} locale={locale} minOrderQty={plant.minOrderQty} />
                </div>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex-1 cursor-not-allowed rounded-md bg-paper-deep px-5 py-3 font-body text-sm font-semibold text-ink-muted"
                >
                  Нет в наличии
                </button>
              )}
              <CompareToggle plant={{ id: plant.id, slug: plant.slug, name: plant.name, categorySlug: plant.category?.slug ?? categorySlug }} />
            </div>

            {!inStock && (
              <RequestForm
                type="plant_availability_alert"
                plantId={plant.id}
                title="Сообщить о поступлении"
                submitLabel="Уведомить меня"
              />
            )}
            <RequestForm type="quote" plantId={plant.id} title="Запросить цену на другой объём" submitLabel="Отправить заявку" />
          </div>
        </div>
      </div>

      {plant.description && (
        <section className="mt-10 max-w-3xl">
          <h2 className="mb-2 font-display text-xl font-semibold text-canopy">Описание</h2>
          <p className="font-body text-[15px] leading-relaxed text-ink">{plant.description}</p>
        </section>
      )}

      <section className="mt-8">
        <details className="rounded-lg border border-border bg-white p-4" open>
          <summary className="cursor-pointer font-display text-lg font-semibold text-canopy">Характеристики</summary>
          <table className="mt-3 w-full font-body text-[13.5px]">
            <tbody>
              {ALL_ATTRIBUTE_CODES.map((code) => {
                const attr = valueByCode.get(code);
                return (
                  <tr key={code} className="border-b border-dashed border-border last:border-none">
                    <td className="py-1.5 text-ink-muted">{ATTRIBUTE_LABELS[code]}</td>
                    <td className="py-1.5 text-right text-ink">
                      {attr ? formatAttributeValue(code, attr.value) : "уточняется"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      </section>

      {compatiblePlants.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-xl font-semibold text-canopy">Хорошо сочетается с</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {compatiblePlants.map((p) => (
              <Link
                key={p.id}
                href={`/${locale}/catalog/${categorySlug}/${p.slug}`}
                className="rounded-md border border-border bg-white p-3 font-body text-[13px] text-ink hover:shadow-sm"
              >
                {p.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl font-semibold text-canopy">Отзывы о поставщике</h2>
        <p className="font-body text-[13.5px] text-ink-muted">Отзывов пока нет.</p>
      </section>
    </main>
  );
}

import { createClient } from "@/lib/supabase/server";

export interface CatalogPlant {
  id: string;
  slug: string;
  latinName: string | null;
  name: string;
  priceFrom: number | null;
  currency: string;
  inStock: boolean;
  coverImage: string | null;
}

// Название приходит из translations (см. Tamga_Green_Database_Design.md, раздел 6).
// Цена "от" — минимальная ступень из prices (раздел 3).
// Соответствует карточке в списке из Tamga_Green_Plant_Catalog.md, раздел 3.
//
// [решено самостоятельно] translations — полиморфная таблица БЕЗ foreign key на plants
// (Database Design §1, принцип 4 — "полиморфные связи по конвенции entity_type+entity_id,
// без FK-constraint"). PostgREST embedding (`translations!inner(...)` внутри `.from("plants")`)
// требует реального FK и никогда не сработает здесь — поэтому переводы запрашиваются
// отдельным select'ом и мёржатся в коде, а не через embedded resource.
export async function getPlantsByCategory(
  categorySlug: string,
  locale: string = "ru"
): Promise<CatalogPlant[]> {
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .single();

  if (!category) return [];

  const { data: plants } = await supabase
    .from("plants")
    .select(
      `id, slug, latin_name,
       plant_images ( file_path, is_cover ),
       prices ( price, currency, min_qty ),
       availability ( quantity )`
    )
    .eq("category_id", category.id)
    .eq("status", "active");

  if (!plants || plants.length === 0) return [];

  const plantIds = plants.map((p) => p.id);

  // Название на запрошенной локали, с откатом на 'en' (Architecture §11 — отсутствие
  // перевода не должно ломать страницу).
  const { data: names } = await supabase
    .from("translations")
    .select("entity_id, locale, value")
    .eq("entity_type", "plant")
    .eq("field", "name")
    .in("entity_id", plantIds)
    .in("locale", locale === "en" ? ["en"] : [locale, "en"]);

  const nameByPlantId = new Map<string, string>();
  for (const row of names ?? []) {
    const existing = nameByPlantId.get(row.entity_id);
    if (!existing || row.locale === locale) {
      nameByPlantId.set(row.entity_id, row.value ?? "");
    }
  }

  return plants.map((p): CatalogPlant => {
    const cover = p.plant_images?.find((img) => img.is_cover) ?? p.plant_images?.[0];
    const cheapestPrice = [...(p.prices ?? [])].sort((a, b) => a.min_qty - b.min_qty)[0];
    const totalStock = (p.availability ?? []).reduce((sum, a) => sum + (a.quantity ?? 0), 0);

    return {
      id: p.id,
      slug: p.slug,
      latinName: p.latin_name,
      name: nameByPlantId.get(p.id) ?? p.slug,
      priceFrom: cheapestPrice?.price ?? null,
      currency: cheapestPrice?.currency ?? "EUR",
      inStock: totalStock > 0,
      coverImage: cover?.file_path ?? null,
    };
  });
}

export interface CatalogCategory {
  id: string;
  slug: string;
  sortOrder: number;
  name: string;
}

// Тот же приём, что в getPlantsByCategory: translations не embedded-joinится
// (нет FK), запрашивается отдельно и мёржится по entity_id.
export async function getCategories(locale: string = "ru"): Promise<CatalogCategory[]> {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, sort_order")
    .order("sort_order");

  if (!categories || categories.length === 0) return [];

  const categoryIds = categories.map((c) => c.id);
  const { data: names } = await supabase
    .from("translations")
    .select("entity_id, locale, value")
    .eq("entity_type", "category")
    .eq("field", "name")
    .in("entity_id", categoryIds)
    .in("locale", locale === "en" ? ["en"] : [locale, "en"]);

  const nameByCategoryId = new Map<string, string>();
  for (const row of names ?? []) {
    const existing = nameByCategoryId.get(row.entity_id);
    if (!existing || row.locale === locale) {
      nameByCategoryId.set(row.entity_id, row.value ?? "");
    }
  }

  return categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    sortOrder: c.sort_order,
    name: nameByCategoryId.get(c.id) ?? c.slug,
  }));
}

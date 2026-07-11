import { createClient } from "@/lib/supabase/server";
export { isAttributeRelevant } from "@/lib/attributeLabels";

// [решено самостоятельно] translations — полиморфная таблица БЕЗ foreign key на plants
// (Database Design §1, принцип 4). PostgREST embedding (`translations!inner(...)`)
// требует реального FK и не работает здесь — переводы запрашиваются отдельно и
// мёржатся в коде везде в этом файле, а не через embedded resource.

function pickLocaleValue(
  rows: { entity_id: string; locale: string; value: string | null }[] | null,
  locale: string
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows ?? []) {
    const existing = map.get(row.entity_id);
    if (!existing || row.locale === locale) map.set(row.entity_id, row.value ?? "");
  }
  return map;
}

async function fetchTranslations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entityType: string,
  field: string,
  ids: string[],
  locale: string
) {
  if (ids.length === 0) return new Map<string, string>();
  const { data } = await supabase
    .from("translations")
    .select("entity_id, locale, value")
    .eq("entity_type", entityType)
    .eq("field", field)
    .in("entity_id", ids)
    .in("locale", locale === "en" ? ["en"] : [locale, "en"]);
  return pickLocaleValue(data, locale);
}

// ==== Категории ====

export interface CatalogCategory {
  id: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  name: string;
}

export async function getCategoryTree(locale: string = "ru"): Promise<CatalogCategory[]> {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, slug, parent_id, sort_order")
    .order("sort_order");
  if (!categories || categories.length === 0) return [];

  const nameByCategoryId = await fetchTranslations(
    supabase,
    "category",
    "name",
    categories.map((c) => c.id),
    locale
  );

  return categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    parentId: c.parent_id,
    sortOrder: c.sort_order,
    name: nameByCategoryId.get(c.id) ?? c.slug,
  }));
}

export interface ResolvedCategory extends CatalogCategory {
  children: CatalogCategory[];
  breadcrumbs: CatalogCategory[]; // от корня до текущей, включительно
}

// Каталог поддерживает адресацию и по родительской (Хвойные), и по дочерней
// (Туи) категории одним и тем же паттерном URL (Plant Catalog §1.2/§1.3).
export async function resolveCategoryBySlug(
  slug: string,
  locale: string = "ru"
): Promise<ResolvedCategory | null> {
  const tree = await getCategoryTree(locale);
  const current = tree.find((c) => c.slug === slug);
  if (!current) return null;

  const children = tree.filter((c) => c.parentId === current.id);

  const breadcrumbs: CatalogCategory[] = [current];
  let cursor = current;
  while (cursor.parentId) {
    const parent = tree.find((c) => c.id === cursor.parentId);
    if (!parent) break;
    breadcrumbs.unshift(parent);
    cursor = parent;
  }

  return { ...current, children, breadcrumbs };
}

// Плоский список id категории + всех потомков — чтобы страница родительской
// категории ("Хвойные") показывала товары всех подкатегорий сразу.
function collectCategoryIds(root: ResolvedCategory): string[] {
  return [root.id, ...root.children.map((c) => c.id)];
}

// ==== Фильтры (Plant Catalog §4 — динамические по attributes.is_filterable) ====

export interface FilterAttribute {
  id: string;
  code: string;
  dataType: string;
  unit: string | null;
  enumOptions: string[] | null;
  categoryId: string | null; // null = глобальный атрибут, иначе — привязан к одной категории
}

export async function getFilterableAttributes(): Promise<FilterAttribute[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("attributes")
    .select("id, code, data_type, unit, enum_options, category_id")
    .eq("is_filterable", true);
  return (data ?? []).map((a) => ({
    id: a.id,
    code: a.code,
    dataType: a.data_type,
    unit: a.unit,
    enumOptions: (a.enum_options as string[] | null) ?? null,
    categoryId: a.category_id,
  }));
}

export interface CatalogFilters {
  inStockOnly?: boolean;
  crownForm?: string; // 'bush' | 'standard'
  minPrice?: number;
  maxPrice?: number;
}

// ==== Товары ====

export interface CatalogPlant {
  id: string;
  slug: string;
  latinName: string | null;
  name: string;
  priceFrom: number | null;
  currency: string;
  inStock: boolean;
  coverImage: string | null;
  categorySlug: string | null;
}

export async function getPlantsByCategory(
  categorySlug: string,
  locale: string = "ru",
  filters: CatalogFilters = {}
): Promise<CatalogPlant[]> {
  const supabase = await createClient();
  const category = await resolveCategoryBySlug(categorySlug, locale);
  if (!category) return [];

  const categoryIds = collectCategoryIds(category);
  // Внутри страницы родительской категории карточка должна вести на URL своей
  // фактической подкатегории (например, /catalog/khvoynye/tui), а не родителя.
  const slugByCategoryId = new Map<string, string>([
    [category.id, category.slug],
    ...category.children.map((c): [string, string] => [c.id, c.slug]),
  ]);

  const query = supabase
    .from("plants")
    .select(
      `id, slug, latin_name, category_id,
       plant_images ( file_path, is_cover ),
       prices ( price, currency, min_qty ),
       availability ( quantity )`
    )
    .in("category_id", categoryIds)
    .eq("status", "active");

  const { data: plants } = await query;
  if (!plants || plants.length === 0) return [];

  let plantIds = plants.map((p) => p.id);

  // Фильтр по форме кроны — через EAV (plant_attribute_values), т.к. это не
  // колонка plants, а динамический атрибут (Plant Catalog §4.1).
  if (filters.crownForm) {
    const { data: attr } = await supabase
      .from("attributes")
      .select("id")
      .eq("code", "crown_form")
      .single();
    if (attr) {
      const { data: matches } = await supabase
        .from("plant_attribute_values")
        .select("plant_id")
        .eq("attribute_id", attr.id)
        .eq("value_text", filters.crownForm)
        .in("plant_id", plantIds);
      const matchSet = new Set((matches ?? []).map((m) => m.plant_id));
      plantIds = plantIds.filter((id) => matchSet.has(id));
    }
  }

  const nameByPlantId = await fetchTranslations(supabase, "plant", "name", plantIds, locale);

  const results = plants
    .filter((p) => plantIds.includes(p.id))
    .map((p): CatalogPlant => {
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
        categorySlug: p.category_id ? (slugByCategoryId.get(p.category_id) ?? categorySlug) : null,
      };
    });

  return results.filter((p) => {
    if (filters.inStockOnly && !p.inStock) return false;
    if (filters.minPrice != null && (p.priceFrom ?? 0) < filters.minPrice) return false;
    if (filters.maxPrice != null && (p.priceFrom ?? Infinity) > filters.maxPrice) return false;
    return true;
  });
}

// ==== Карточка товара (Plant Catalog §2) ====

export interface PlantDetail {
  id: string;
  slug: string;
  latinName: string | null;
  name: string;
  description: string | null;
  images: { filePath: string; isCover: boolean }[];
  priceTiers: { minQty: number; price: number; currency: string }[];
  totalStock: number;
  stockUpdatedAt: string | null;
  minOrderQty: number;
  attributes: { code: string; unit: string | null; value: string }[];
  category: { id: string; slug: string; name: string; parentId: string | null; parentSlug: string | null } | null;
  company: { id: string; name: string; slug: string; country: string; ratingAvg: number } | null;
}

export async function getPlantBySlug(slug: string, locale: string = "ru"): Promise<PlantDetail | null> {
  const supabase = await createClient();
  const { data: plant } = await supabase
    .from("plants")
    .select(
      `id, slug, latin_name, category_id, company_id, min_order_qty,
       plant_images ( file_path, is_cover ),
       prices ( min_qty, price, currency ),
       availability ( quantity, updated_at )`
    )
    .eq("slug", slug)
    .eq("status", "active")
    .single();
  if (!plant) return null;

  const [nameMap, descriptionMap, attrValues, categoryRow, companyRow] = await Promise.all([
    fetchTranslations(supabase, "plant", "name", [plant.id], locale),
    fetchTranslations(supabase, "plant", "description", [plant.id], locale),
    supabase
      .from("plant_attribute_values")
      .select("value_text, value_number, value_boolean, attributes ( code, unit )")
      .eq("plant_id", plant.id),
    plant.category_id
      ? supabase.from("categories").select("id, slug, parent_id").eq("id", plant.category_id).single()
      : Promise.resolve({ data: null }),
    plant.company_id
      ? supabase
          .from("companies")
          .select("id, name, slug, country, rating_avg")
          .eq("id", plant.company_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  let category: PlantDetail["category"] = null;
  if (categoryRow.data) {
    const catNameMap = await fetchTranslations(supabase, "category", "name", [categoryRow.data.id], locale);
    let parentSlug: string | null = null;
    if (categoryRow.data.parent_id) {
      const { data: parent } = await supabase
        .from("categories")
        .select("slug")
        .eq("id", categoryRow.data.parent_id)
        .single();
      parentSlug = parent?.slug ?? null;
    }
    category = {
      id: categoryRow.data.id,
      slug: categoryRow.data.slug,
      name: catNameMap.get(categoryRow.data.id) ?? categoryRow.data.slug,
      parentId: categoryRow.data.parent_id,
      parentSlug,
    };
  }

  const totalStock = (plant.availability ?? []).reduce((sum, a) => sum + (a.quantity ?? 0), 0);
  const stockUpdatedAt = plant.availability?.[0]?.updated_at ?? null;

  return {
    id: plant.id,
    slug: plant.slug,
    latinName: plant.latin_name,
    minOrderQty: plant.min_order_qty ?? 1,
    name: nameMap.get(plant.id) ?? plant.slug,
    description: descriptionMap.get(plant.id) ?? null,
    images: (plant.plant_images ?? []).map((i) => ({ filePath: i.file_path, isCover: i.is_cover ?? false })),
    priceTiers: [...(plant.prices ?? [])]
      .sort((a, b) => a.min_qty - b.min_qty)
      .map((p) => ({ minQty: p.min_qty, price: p.price, currency: p.currency })),
    totalStock,
    stockUpdatedAt,
    attributes: (attrValues.data ?? [])
      .map((v) => {
        const attr = v.attributes as unknown as { code: string; unit: string | null } | null;
        const value = v.value_text ?? (v.value_number != null ? String(v.value_number) : v.value_boolean != null ? String(v.value_boolean) : null);
        if (!attr || value == null) return null;
        return { code: attr.code, unit: attr.unit, value };
      })
      .filter((v): v is { code: string; unit: string | null; value: string } => v !== null),
    category,
    company: companyRow.data
      ? {
          id: companyRow.data.id,
          name: companyRow.data.name,
          slug: companyRow.data.slug,
          country: companyRow.data.country,
          ratingAvg: companyRow.data.rating_avg ?? 0,
        }
      : null,
  };
}

// Для страницы сравнения (Plant Catalog §6.2) — полные карточки (с атрибутами),
// а не сокращённые CatalogPlant. До 4 позиций, поэтому N+1 через getPlantBySlug
// не является проблемой производительности здесь.
export async function getPlantDetailsByIds(ids: string[], locale: string = "ru"): Promise<PlantDetail[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data: rows } = await supabase.from("plants").select("slug").in("id", ids).eq("status", "active");
  const slugs = (rows ?? []).map((r) => r.slug);
  const details = await Promise.all(slugs.map((slug) => getPlantBySlug(slug, locale)));
  return details.filter((d): d is PlantDetail => d !== null);
}

// Публичный профиль поставщика (SEO Strategy §1.2) — карточки его активного каталога.
export async function getPlantsByCompany(companyId: string, locale: string = "ru"): Promise<CatalogPlant[]> {
  const supabase = await createClient();
  const { data: plants } = await supabase.from("plants").select("id").eq("company_id", companyId).eq("status", "active");
  return getPlantsByIds((plants ?? []).map((p) => p.id), locale);
}

export async function getPlantsByIds(ids: string[], locale: string = "ru"): Promise<CatalogPlant[]> {
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data: plants } = await supabase
    .from("plants")
    .select(
      `id, slug, latin_name, category_id,
       plant_images ( file_path, is_cover ),
       prices ( price, currency, min_qty ),
       availability ( quantity )`
    )
    .in("id", ids)
    .eq("status", "active");
  if (!plants) return [];

  const nameByPlantId = await fetchTranslations(supabase, "plant", "name", plants.map((p) => p.id), locale);

  const categoryIds = [...new Set(plants.map((p) => p.category_id).filter((id): id is string => !!id))];
  const { data: categoryRows } = categoryIds.length
    ? await supabase.from("categories").select("id, slug").in("id", categoryIds)
    : { data: [] as { id: string; slug: string }[] };
  const slugByCategoryId = new Map((categoryRows ?? []).map((c) => [c.id, c.slug]));

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
      categorySlug: p.category_id ? (slugByCategoryId.get(p.category_id) ?? null) : null,
    };
  });
}

// ==== Поиск (Architecture §9.1 — tsvector; AI Architecture §4 embedding-канал — Phase 6) ====

export async function searchPlants(query: string, locale: string = "ru"): Promise<CatalogPlant[]> {
  const supabase = await createClient();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data: ftsMatches } = await supabase
    .from("plants")
    .select("id")
    .eq("status", "active")
    .textSearch("search_vector", trimmed, { type: "websearch", config: "simple" });

  let ids = (ftsMatches ?? []).map((p) => p.id);

  // Fallback на pg_trgm similarity по названию, если полнотекстовый поиск не дал
  // результатов (опечатка/частичное совпадение) — Architecture §9.1.
  if (ids.length === 0) {
    const { data: fuzzy } = await supabase.rpc("search_plants_fuzzy", { query_text: trimmed });
    ids = (fuzzy ?? []).map((r: { plant_id: string }) => r.plant_id);
  }

  // Embedding-канал (AI Architecture §4) — reciprocal rank fusion поверх того же
  // набора результатов, когда доступен VOYAGE_API_KEY и таблица plant_embeddings
  // заполнена (0009_embeddings.sql). Без ключа generateEmbedding() возвращает null
  // и этот блок no-op — поиск остаётся на tsvector+pg_trgm (уже рабочий MVP).
  const { generateEmbedding } = await import("@/lib/ai/embeddings");
  const queryEmbedding = await generateEmbedding(trimmed);
  if (queryEmbedding) {
    const { data: semanticMatches } = await supabase.rpc("match_plant_embeddings", {
      query_embedding: queryEmbedding,
      match_count: 10,
    });
    const semanticIds = (semanticMatches ?? []).map((r) => r.plant_id);
    ids = [...new Set([...ids, ...semanticIds])];
  }

  return getPlantsByIds(ids, locale);
}

// ==== Заявки (Plant Catalog §11) ====

export async function getCompatiblePlants(plantId: string, locale: string = "ru"): Promise<CatalogPlant[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plant_compatibility")
    .select("plant_id_a, plant_id_b")
    .eq("relation", "companion")
    .eq("source", "expert")
    .or(`plant_id_a.eq.${plantId},plant_id_b.eq.${plantId}`)
    .limit(4);

  const relatedIds = (data ?? []).map((row) => (row.plant_id_a === plantId ? row.plant_id_b : row.plant_id_a));
  return getPlantsByIds(relatedIds, locale);
}

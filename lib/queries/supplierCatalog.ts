import { createClient } from "@/lib/supabase/server";

export interface SupplierPlantRow {
  id: string;
  slug: string;
  name: string;
  categoryName: string | null;
  stock: number;
  priceFrom: number | null;
  currency: string;
  status: string;
  needsAiAttention: boolean;
  coverImage: string | null;
}

async function getSupplierCompanyId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
  return profile?.company_id ?? null;
}

// Admin Panel §2 — дашборд каталога: таблица + счётчики.
export async function getSupplierPlants(locale: string = "ru"): Promise<SupplierPlantRow[]> {
  const supabase = await createClient();
  const companyId = await getSupplierCompanyId(supabase);
  if (!companyId) return [];

  const { data: plants } = await supabase
    .from("plants")
    .select(
      `id, slug, status, category_id,
       plant_images ( file_path, is_cover ),
       prices ( price, currency, min_qty ),
       availability ( quantity )`
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (!plants || plants.length === 0) return [];

  const plantIds = plants.map((p) => p.id);
  const { data: nameRows } = await supabase
    .from("translations")
    .select("entity_id, locale, value")
    .eq("entity_type", "plant")
    .eq("field", "name")
    .in("entity_id", plantIds)
    .in("locale", locale === "en" ? ["en"] : [locale, "en"]);
  const nameByPlant = new Map<string, string>();
  for (const row of nameRows ?? []) {
    const existing = nameByPlant.get(row.entity_id);
    if (!existing || row.locale === locale) nameByPlant.set(row.entity_id, row.value ?? "");
  }
  const { data: descRows } = await supabase
    .from("translations")
    .select("entity_id")
    .eq("entity_type", "plant")
    .eq("field", "description")
    .in("entity_id", plantIds);
  const hasDescription = new Set((descRows ?? []).map((r) => r.entity_id));

  const categoryIds = [...new Set(plants.map((p) => p.category_id).filter((id): id is string => !!id))];
  const { data: categoryRows } = categoryIds.length
    ? await supabase.from("categories").select("id, slug").in("id", categoryIds)
    : { data: [] as { id: string; slug: string }[] };
  const { data: catNameRows } = categoryIds.length
    ? await supabase
        .from("translations")
        .select("entity_id, locale, value")
        .eq("entity_type", "category")
        .eq("field", "name")
        .in("entity_id", categoryIds)
    : { data: [] as { entity_id: string; locale: string; value: string | null }[] };
  const catNameById = new Map<string, string>();
  for (const row of catNameRows ?? []) {
    if (row.locale === locale || !catNameById.has(row.entity_id)) catNameById.set(row.entity_id, row.value ?? "");
  }
  const catSlugById = new Map((categoryRows ?? []).map((c) => [c.id, c.slug]));

  return plants.map((p): SupplierPlantRow => {
    const cover = p.plant_images?.find((img) => img.is_cover) ?? p.plant_images?.[0];
    const cheapestPrice = [...(p.prices ?? [])].sort((a, b) => a.min_qty - b.min_qty)[0];
    const totalStock = (p.availability ?? []).reduce((sum, a) => sum + (a.quantity ?? 0), 0);
    // "Требует внимания AI" (Admin Panel §2) — честный прокси без реальной vision-
    // проверки (см. TODO.md): нет фото ИЛИ нет сгенерированного описания.
    const needsAiAttention = !cover || !hasDescription.has(p.id);

    return {
      id: p.id,
      slug: p.slug,
      name: nameByPlant.get(p.id) ?? p.slug,
      categoryName: p.category_id ? (catNameById.get(p.category_id) ?? catSlugById.get(p.category_id) ?? null) : null,
      stock: totalStock,
      priceFrom: cheapestPrice?.price ?? null,
      currency: cheapestPrice?.currency ?? "KGS",
      status: p.status,
      needsAiAttention,
      coverImage: cover?.file_path ?? null,
    };
  });
}

export interface SupplierDashboardCounts {
  total: number;
  outOfStock: number;
  needsAiAttention: number;
}

export async function getSupplierDashboardCounts(): Promise<SupplierDashboardCounts> {
  const plants = await getSupplierPlants();
  return {
    total: plants.length,
    outOfStock: plants.filter((p) => p.stock === 0).length,
    needsAiAttention: plants.filter((p) => p.needsAiAttention).length,
  };
}

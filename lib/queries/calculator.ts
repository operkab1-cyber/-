import { createClient } from "@/lib/supabase/server";

export interface CalculatorPlantItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  oos: boolean;
}

export interface CalculatorCategory {
  slug: string;
  label: string;
  items: CalculatorPlantItem[];
}

// Rule 9 — landscaping_calculator.html подключается к реальным данным из БД
// вместо захардкоженного JSON. Форма результата намеренно повторяет структуру
// оригинального CATALOG (categorySlug -> список {name, price, oos}), чтобы
// перенесённая клиентская логика калькулятора менялась минимально.
export async function getCalculatorCatalog(locale: string = "ru"): Promise<CalculatorCategory[]> {
  const supabase = await createClient();

  const { data: topCategories } = await supabase.from("categories").select("id, slug").is("parent_id", null).order("sort_order");
  if (!topCategories || topCategories.length === 0) return [];

  const { data: catNames } = await supabase
    .from("translations")
    .select("entity_id, locale, value")
    .eq("entity_type", "category")
    .eq("field", "name")
    .in(
      "entity_id",
      topCategories.map((c) => c.id)
    );
  const nameByCategoryId = new Map<string, string>();
  for (const row of catNames ?? []) {
    if (row.locale === locale || !nameByCategoryId.has(row.entity_id)) nameByCategoryId.set(row.entity_id, row.value ?? "");
  }

  const { data: subCategories } = await supabase.from("categories").select("id, parent_id").not("parent_id", "is", null);
  const subIdsByParent = new Map<string, string[]>();
  for (const sub of subCategories ?? []) {
    if (!sub.parent_id) continue;
    subIdsByParent.set(sub.parent_id, [...(subIdsByParent.get(sub.parent_id) ?? []), sub.id]);
  }

  const results: CalculatorCategory[] = [];
  for (const top of topCategories) {
    const categoryIds = [top.id, ...(subIdsByParent.get(top.id) ?? [])];
    const { data: plants } = await supabase
      .from("plants")
      .select("id, prices ( price, currency, min_qty ), availability ( quantity )")
      .in("category_id", categoryIds)
      .eq("status", "active");
    if (!plants || plants.length === 0) continue;

    const plantIds = plants.map((p) => p.id);
    const { data: names } = await supabase
      .from("translations")
      .select("entity_id, locale, value")
      .eq("entity_type", "plant")
      .eq("field", "name")
      .in("entity_id", plantIds);
    const nameByPlant = new Map<string, string>();
    for (const row of names ?? []) {
      if (row.locale === locale || !nameByPlant.has(row.entity_id)) nameByPlant.set(row.entity_id, row.value ?? "");
    }

    const items: CalculatorPlantItem[] = plants
      .map((p) => {
        const cheapest = [...(p.prices ?? [])].sort((a, b) => a.min_qty - b.min_qty)[0];
        const stock = (p.availability ?? []).reduce((sum, a) => sum + (a.quantity ?? 0), 0);
        if (!cheapest) return null;
        return {
          id: p.id,
          name: nameByPlant.get(p.id) ?? "",
          price: cheapest.price,
          currency: cheapest.currency,
          oos: stock === 0,
        };
      })
      .filter((i): i is CalculatorPlantItem => i !== null);

    results.push({ slug: top.slug, label: nameByCategoryId.get(top.id) ?? top.slug, items });
  }

  return results;
}

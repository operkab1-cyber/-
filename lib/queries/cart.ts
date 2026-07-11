import { createClient } from "@/lib/supabase/server";

export interface CartLineItem {
  itemId: string;
  plantId: string;
  slug: string;
  categorySlug: string | null;
  name: string;
  qty: number;
  unitPrice: number;
  currency: string;
  minOrderQty: number;
}

export interface CartSupplierGroup {
  companyId: string;
  companyName: string;
  minOrderQty: number; // минимум по компании — Database Design не хранит его на companies,
  // используем max(min_order_qty) среди позиций группы как приближение (см. отчёт Phase 4)
  subtotal: number;
  currency: string;
  items: CartLineItem[];
  meetsMinimum: boolean;
}

export interface CartSummary {
  cartId: string | null;
  groups: CartSupplierGroup[];
  total: number;
}

// UX Bible §8.1 — корзина группируется по поставщику. С одним поставщиком в seed
// группа всегда одна, но логика написана для настоящей мультивендорности.
export async function getCartSummary(locale: string = "ru"): Promise<CartSummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { cartId: null, groups: [], total: 0 };

  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
  if (!profile?.company_id) return { cartId: null, groups: [], total: 0 };

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("buyer_company_id", profile.company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cart) return { cartId: null, groups: [], total: 0 };

  const { data: items } = await supabase
    .from("cart_items")
    .select("id, plant_id, qty, price_snapshot")
    .eq("cart_id", cart.id);
  if (!items || items.length === 0) return { cartId: cart.id, groups: [], total: 0 };

  const plantIds = items.map((i) => i.plant_id).filter((id): id is string => !!id);
  const { data: plants } = await supabase
    .from("plants")
    .select("id, slug, category_id, company_id, min_order_qty")
    .in("id", plantIds);
  const { data: prices } = await supabase.from("prices").select("plant_id, currency").in("plant_id", plantIds);
  const currencyByPlant = new Map((prices ?? []).map((p) => [p.plant_id, p.currency]));

  const categoryIds = [...new Set((plants ?? []).map((p) => p.category_id).filter((id): id is string => !!id))];
  const { data: categoryRows } = categoryIds.length
    ? await supabase.from("categories").select("id, slug").in("id", categoryIds)
    : { data: [] as { id: string; slug: string }[] };
  const categorySlugById = new Map((categoryRows ?? []).map((c) => [c.id, c.slug]));

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

  const companyIds = [...new Set((plants ?? []).map((p) => p.company_id).filter((id): id is string => !!id))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] as { id: string; name: string }[] };
  const companyById = new Map((companies ?? []).map((c) => [c.id, c]));
  const plantById = new Map((plants ?? []).map((p) => [p.id, p]));

  const groupsByCompany = new Map<string, CartSupplierGroup>();
  let total = 0;

  for (const item of items) {
    if (!item.plant_id) continue;
    const plant = plantById.get(item.plant_id);
    if (!plant?.company_id) continue;
    const company = companyById.get(plant.company_id);
    const currency = currencyByPlant.get(item.plant_id) ?? "KGS";
    const lineTotal = item.price_snapshot * item.qty;
    total += lineTotal;

    const lineItem: CartLineItem = {
      itemId: item.id,
      plantId: item.plant_id,
      slug: plant.slug,
      categorySlug: plant.category_id ? (categorySlugById.get(plant.category_id) ?? null) : null,
      name: nameByPlant.get(item.plant_id) ?? plant.slug,
      qty: item.qty,
      unitPrice: item.price_snapshot,
      currency,
      minOrderQty: plant.min_order_qty ?? 1,
    };

    let group = groupsByCompany.get(plant.company_id);
    if (!group) {
      group = {
        companyId: plant.company_id,
        companyName: company?.name ?? "Поставщик",
        minOrderQty: lineItem.minOrderQty,
        subtotal: 0,
        currency,
        items: [],
        meetsMinimum: true,
      };
      groupsByCompany.set(plant.company_id, group);
    }
    group.items.push(lineItem);
    group.subtotal += lineTotal;
    group.minOrderQty = Math.max(group.minOrderQty, lineItem.minOrderQty);
  }

  for (const group of groupsByCompany.values()) {
    const totalQty = group.items.reduce((s, i) => s + i.qty, 0);
    group.meetsMinimum = totalQty >= group.minOrderQty;
  }

  return { cartId: cart.id, groups: [...groupsByCompany.values()], total };
}

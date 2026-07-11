import { createClient } from "@/lib/supabase/server";

export interface SalesPoint {
  period: string;
  total: number;
}

export interface TopPlant {
  plantId: string;
  name: string;
  qtySold: number;
}

async function getSupplierCompanyId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
  return profile?.company_id ?? null;
}

// Admin Panel §8.1 — минимум для MVP: "продажи за период" + "топ по спросу".
export async function getSalesByPeriod(): Promise<SalesPoint[]> {
  const supabase = await createClient();
  const companyId = await getSupplierCompanyId(supabase);
  if (!companyId) return [];

  const { data: orders } = await supabase
    .from("orders")
    .select("total, created_at")
    .eq("supplier_company_id", companyId)
    .neq("status", "cancelled");
  if (!orders) return [];

  const byWeek = new Map<string, number>();
  for (const o of orders) {
    const date = new Date(o.created_at);
    const week = `${date.getFullYear()}-W${String(getWeekNumber(date)).padStart(2, "0")}`;
    byWeek.set(week, (byWeek.get(week) ?? 0) + o.total);
  }
  return [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([period, total]) => ({ period, total }));
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export async function getTopPlantsByDemand(locale: string = "ru"): Promise<TopPlant[]> {
  const supabase = await createClient();
  const companyId = await getSupplierCompanyId(supabase);
  if (!companyId) return [];

  const { data: orders } = await supabase.from("orders").select("id").eq("supplier_company_id", companyId).neq("status", "cancelled");
  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) return [];

  const { data: items } = await supabase.from("order_items").select("plant_id, qty").in("order_id", orderIds);
  const qtyByPlant = new Map<string, number>();
  for (const item of items ?? []) {
    if (!item.plant_id) continue;
    qtyByPlant.set(item.plant_id, (qtyByPlant.get(item.plant_id) ?? 0) + item.qty);
  }
  const plantIds = [...qtyByPlant.keys()];
  if (plantIds.length === 0) return [];

  const { data: names } = await supabase
    .from("translations")
    .select("entity_id, locale, value")
    .eq("entity_type", "plant")
    .eq("field", "name")
    .in("entity_id", plantIds)
    .in("locale", locale === "en" ? ["en"] : [locale, "en"]);
  const nameById = new Map<string, string>();
  for (const row of names ?? []) {
    const existing = nameById.get(row.entity_id);
    if (!existing || row.locale === locale) nameById.set(row.entity_id, row.value ?? "");
  }

  return [...qtyByPlant.entries()]
    .map(([plantId, qtySold]) => ({ plantId, name: nameById.get(plantId) ?? plantId, qtySold }))
    .sort((a, b) => b.qtySold - a.qtySold)
    .slice(0, 5);
}

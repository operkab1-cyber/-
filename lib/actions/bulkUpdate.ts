"use server";

// Admin Panel §4.2/§5.4 — массовое изменение цен/остатков с предпросмотром
// "до/после" перед применением, логирование в audit_log + price_change_log
// (для отката цен в течение 24ч — восстановление реализовано, таймер отката
// как отдельная UI-функция — backlog, см. TODO.md).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BulkField = "price" | "stock";
export type BulkOp = "percent" | "delta" | "fixed";

export interface BulkPreviewRow {
  plantId: string;
  name: string;
  before: number;
  after: number;
}

function applyOp(value: number, op: BulkOp, amount: number): number {
  if (op === "percent") return Math.round(value * (1 + amount / 100));
  if (op === "delta") return Math.max(0, value + amount);
  return amount; // fixed
}

async function getSupplierCompanyId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
  return profile?.company_id ?? null;
}

export async function previewBulkUpdate(field: BulkField, op: BulkOp, amount: number, categoryId: string | null): Promise<BulkPreviewRow[]> {
  const supabase = await createClient();
  const companyId = await getSupplierCompanyId(supabase);
  if (!companyId) return [];

  let plantsQuery = supabase.from("plants").select("id").eq("company_id", companyId);
  if (categoryId) plantsQuery = plantsQuery.eq("category_id", categoryId);
  const { data: plants } = await plantsQuery;
  if (!plants || plants.length === 0) return [];
  const plantIds = plants.map((p) => p.id);

  const { data: names } = await supabase
    .from("translations")
    .select("entity_id, value")
    .eq("entity_type", "plant")
    .eq("field", "name")
    .in("entity_id", plantIds);
  const nameById = new Map((names ?? []).map((n) => [n.entity_id, n.value ?? ""]));

  if (field === "price") {
    const { data: prices } = await supabase.from("prices").select("plant_id, price").in("plant_id", plantIds).order("min_qty");
    const seen = new Set<string>();
    const rows: BulkPreviewRow[] = [];
    for (const p of prices ?? []) {
      if (seen.has(p.plant_id)) continue; // только первая (минимальная) ступень для превью
      seen.add(p.plant_id);
      rows.push({ plantId: p.plant_id, name: nameById.get(p.plant_id) ?? "", before: p.price, after: applyOp(p.price, op, amount) });
    }
    return rows.slice(0, 200);
  }

  const { data: avail } = await supabase.from("availability").select("plant_id, quantity").in("plant_id", plantIds);
  return (avail ?? [])
    .map((a) => ({ plantId: a.plant_id, name: nameById.get(a.plant_id) ?? "", before: a.quantity, after: applyOp(a.quantity, op, amount) }))
    .slice(0, 200);
}

export interface BulkApplyResult {
  error?: string;
  affected?: number;
}

export async function applyBulkUpdate(field: BulkField, op: BulkOp, amount: number, categoryId: string | null, locale: string): Promise<BulkApplyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const { data: profile } = await supabase.from("users").select("id, company_id").eq("id", user.id).single();
  if (!profile?.company_id) return { error: "Профиль поставщика не найден" };

  const rows = await previewBulkUpdate(field, op, amount, categoryId);
  if (rows.length === 0) return { error: "Нет товаров, подходящих под условие" };

  const { data: auditRow, error: auditError } = await supabase
    .from("audit_log")
    .insert({
      actor_id: profile.id,
      action: field === "price" ? "bulk_price_update" : "bulk_stock_update",
      entity_type: "plant",
      before: { rows: rows.map((r) => ({ plantId: r.plantId, value: r.before })) },
      after: { op, amount, affected: rows.length },
    })
    .select("id")
    .single();
  if (auditError || !auditRow) return { error: auditError?.message ?? "Не удалось записать в журнал" };

  for (const row of rows) {
    if (field === "price") {
      const { data: priceRow } = await supabase.from("prices").select("id, min_qty, price, currency").eq("plant_id", row.plantId).order("min_qty").limit(1).maybeSingle();
      if (priceRow) {
        await supabase.from("prices").update({ price: row.after }).eq("id", priceRow.id);
        await supabase.from("price_change_log").insert({
          audit_log_id: auditRow.id,
          plant_id: row.plantId,
          previous_price: priceRow.price,
          previous_min_qty: priceRow.min_qty,
          previous_currency: priceRow.currency,
        });
      }
    } else {
      const { data: availRow } = await supabase.from("availability").select("id").eq("plant_id", row.plantId).limit(1).maybeSingle();
      if (availRow) await supabase.from("availability").update({ quantity: row.after, updated_at: new Date().toISOString() }).eq("id", availRow.id);
    }
  }

  revalidatePath(`/${locale}/supplier/products`);
  return { affected: rows.length };
}

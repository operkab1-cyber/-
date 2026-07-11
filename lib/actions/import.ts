"use server";

// Admin Panel §7.5-7.6 — финальное подтверждение импорта: создаёт черновики,
// не публикует автоматически (human-in-the-loop, AI Architecture §13.4). Повторный
// импорт сопоставляет по slug (упрощённый аналог fuzzy-match по названию+латыни
// из §7.6 — см. отчёт Phase 5) и обновляет цену/остаток вместо дубликата.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import { parseAttributes, extractLatinName, generateDescription } from "@/lib/ai/parsePlantName";

export interface ImportRow {
  rawName: string;
  price: number;
  outOfStock: boolean;
  categoryId: string; // разрешённая на клиенте категория (существующая или "uncategorized")
  categoryLabel: string;
}

export interface ImportResult {
  error?: string;
  created?: number;
  updated?: number;
}

export async function confirmImport(rows: ImportRow[], locale: string): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };
  const { data: profile } = await supabase.from("users").select("id, company_id").eq("id", user.id).single();
  if (!profile?.company_id) return { error: "Профиль поставщика не найден" };

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const latinName = extractLatinName(row.rawName);
    const attrs = parseAttributes(row.rawName);
    const slug = slugify(row.rawName);

    const { data: existing } = await supabase
      .from("plants")
      .select("id")
      .eq("company_id", profile.company_id)
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      const { data: priceRow } = await supabase.from("prices").select("id").eq("plant_id", existing.id).order("min_qty").limit(1).maybeSingle();
      if (priceRow) await supabase.from("prices").update({ price: row.price }).eq("id", priceRow.id);
      else await supabase.from("prices").insert({ plant_id: existing.id, min_qty: 1, price: row.price, currency: "KGS" });

      const { data: availRow } = await supabase.from("availability").select("id").eq("plant_id", existing.id).limit(1).maybeSingle();
      const qty = row.outOfStock ? 0 : (availRow ? undefined : 20);
      if (availRow) {
        if (row.outOfStock) await supabase.from("availability").update({ quantity: 0 }).eq("id", availRow.id);
      } else {
        await supabase.from("availability").insert({ plant_id: existing.id, quantity: qty ?? 20 });
      }
      updated += 1;
      continue;
    }

    const { data: plant, error } = await supabase
      .from("plants")
      .insert({
        company_id: profile.company_id,
        category_id: row.categoryId === "uncategorized" ? null : row.categoryId,
        slug,
        latin_name: latinName,
        status: "draft", // Admin Panel §7.5 — импорт всегда создаёт черновики
      })
      .select("id")
      .single();
    if (error || !plant) continue;

    await supabase.from("translations").insert({ entity_type: "plant", entity_id: plant.id, field: "name", locale, value: row.rawName });
    const description = generateDescription({ name: row.rawName, latinName, categoryLabel: row.categoryLabel, attrs });
    await supabase.from("translations").insert({ entity_type: "plant", entity_id: plant.id, field: "description", locale, value: description });
    await supabase.from("prices").insert({ plant_id: plant.id, min_qty: 1, price: row.price, currency: "KGS" });
    await supabase.from("availability").insert({ plant_id: plant.id, quantity: row.outOfStock ? 0 : 20 });
    created += 1;
  }

  await supabase.from("audit_log").insert({
    actor_id: profile.id,
    action: "excel_import",
    entity_type: "plant",
    after: { created, updated, total: rows.length },
  });

  revalidatePath(`/${locale}/supplier/products`);
  return { created, updated };
}

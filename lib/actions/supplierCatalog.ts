"use server";

// Admin Panel §3 (добавление/дублирование), §4 (цены), §5 (остатки), §9 (audit_log).
// RLS (supplier_manage_own_plants и т.д., 0002/0007) — последний рубеж: даже если
// проверка company_id здесь была бы обойдена, база не даст записать чужой товар.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { plantFormSchema } from "@/lib/validation/plant";
import { slugify, randomSlugSuffix } from "@/lib/slug";

async function getSupplierProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("id, company_id").eq("id", user.id).single();
  return profile;
}

async function getAttributeIds(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("attributes").select("id, code");
  return new Map((data ?? []).map((a) => [a.code, a.id]));
}

export interface PlantFormResult {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  plantId?: string;
}

// Admin Panel §3.1 — публикует сразу (status='active'), "Сохранить как черновик"
// вызывает этот же action с publish=false.
export async function createPlant(formData: FormData, publish: boolean, locale: string): Promise<PlantFormResult> {
  const supabase = await createClient();
  const profile = await getSupplierProfile(supabase);
  if (!profile?.company_id) return { error: "Профиль поставщика не найден" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = plantFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const data = parsed.data;

  const baseSlug = slugify(data.name);
  let slug = baseSlug;
  let plantId: string | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: plant, error } = await supabase
      .from("plants")
      .insert({
        company_id: profile.company_id,
        category_id: data.categoryId,
        slug,
        latin_name: data.latinName || null,
        min_order_qty: data.minQty,
        status: publish ? "active" : "draft",
      })
      .select("id")
      .single();
    if (!error && plant) {
      plantId = plant.id;
      break;
    }
    if (error && !/duplicate key|unique/i.test(error.message)) return { error: error.message };
    slug = `${baseSlug}-${randomSlugSuffix()}`;
  }
  if (!plantId) return { error: "Не удалось создать товар" };

  await supabase.from("translations").insert({ entity_type: "plant", entity_id: plantId, field: "name", locale, value: data.name });
  await supabase.from("prices").insert({ plant_id: plantId, min_qty: data.minQty, price: data.price, currency: "KGS" });
  await supabase.from("availability").insert({ plant_id: plantId, quantity: data.stockQty });

  const attributeIds = await getAttributeIds(supabase);
  const attrValues: { code: string; value: string }[] = [
    { code: "hardiness_zone", value: data.hardinessZone ?? "" },
    { code: "light", value: data.light ?? "" },
    { code: "height_range", value: data.heightRange ?? "" },
    { code: "foliage_type", value: data.foliageType ?? "" },
    { code: "container_volume", value: data.containerVolume ?? "" },
    { code: "crown_form", value: data.crownForm ?? "" },
  ].filter((a) => a.value);

  for (const attr of attrValues) {
    const attributeId = attributeIds.get(attr.code);
    if (!attributeId) continue;
    await supabase.from("plant_attribute_values").insert({ plant_id: plantId, attribute_id: attributeId, value_text: attr.value });
  }

  await supabase.from("audit_log").insert({
    actor_id: profile.id,
    action: publish ? "create_plant_published" : "create_plant_draft",
    entity_type: "plant",
    entity_id: plantId,
    after: { name: data.name, price: data.price, stockQty: data.stockQty },
  });

  revalidatePath(`/${locale}/supplier/products`);
  redirect(`/${locale}/supplier/products`);
}

// Admin Panel §3.2 — дублирование: копирует поля, кроме фото и остатка.
export async function duplicatePlant(plantId: string, locale: string): Promise<PlantFormResult> {
  const supabase = await createClient();
  const profile = await getSupplierProfile(supabase);
  if (!profile?.company_id) return { error: "Профиль поставщика не найден" };

  const { data: source } = await supabase
    .from("plants")
    .select("slug, latin_name, category_id, min_order_qty, company_id")
    .eq("id", plantId)
    .single();
  if (!source || source.company_id !== profile.company_id) return { error: "Товар не найден" };

  const { data: nameRow } = await supabase
    .from("translations")
    .select("value")
    .eq("entity_type", "plant")
    .eq("entity_id", plantId)
    .eq("field", "name")
    .limit(1)
    .maybeSingle();

  const newSlug = `${source.slug}-${randomSlugSuffix()}`;
  const { data: copy, error } = await supabase
    .from("plants")
    .insert({
      company_id: profile.company_id,
      category_id: source.category_id,
      slug: newSlug,
      latin_name: source.latin_name,
      min_order_qty: source.min_order_qty,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !copy) return { error: error?.message ?? "Не удалось дублировать товар" };

  if (nameRow?.value) {
    await supabase
      .from("translations")
      .insert({ entity_type: "plant", entity_id: copy.id, field: "name", locale, value: `${nameRow.value} (копия)` });
  }
  await supabase.from("availability").insert({ plant_id: copy.id, quantity: 0 });

  await supabase.from("audit_log").insert({
    actor_id: profile.id,
    action: "duplicate_plant",
    entity_type: "plant",
    entity_id: copy.id,
    before: { source_plant_id: plantId },
  });

  revalidatePath(`/${locale}/supplier/products`);
  redirect(`/${locale}/supplier/products`);
}

// Admin Panel §4.1 — точечное изменение цены, инлайн в таблице.
export async function updatePlantPrice(plantId: string, price: number, locale: string): Promise<PlantFormResult> {
  const supabase = await createClient();
  const profile = await getSupplierProfile(supabase);
  if (!profile?.company_id) return { error: "Не авторизован" };

  const { data: existing } = await supabase.from("prices").select("id, price").eq("plant_id", plantId).order("min_qty").limit(1).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("prices").update({ price }).eq("id", existing.id);
    if (error) return { error: error.message };
    await supabase.from("audit_log").insert({
      actor_id: profile.id,
      action: "update_price",
      entity_type: "plant",
      entity_id: plantId,
      before: { price: existing.price },
      after: { price },
    });
  } else {
    const { error } = await supabase.from("prices").insert({ plant_id: plantId, min_qty: 1, price, currency: "KGS" });
    if (error) return { error: error.message };
  }

  revalidatePath(`/${locale}/supplier/products`);
  return {};
}

// Admin Panel §5.1 — точечное изменение остатка, инлайн в таблице.
export async function updatePlantStock(plantId: string, quantity: number, locale: string): Promise<PlantFormResult> {
  const supabase = await createClient();
  const profile = await getSupplierProfile(supabase);
  if (!profile?.company_id) return { error: "Не авторизован" };

  const { data: existing } = await supabase.from("availability").select("id, quantity").eq("plant_id", plantId).limit(1).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("availability").update({ quantity, updated_at: new Date().toISOString() }).eq("id", existing.id);
    if (error) return { error: error.message };
    await supabase.from("audit_log").insert({
      actor_id: profile.id,
      action: "update_stock",
      entity_type: "plant",
      entity_id: plantId,
      before: { quantity: existing.quantity },
      after: { quantity },
    });
  } else {
    const { error } = await supabase.from("availability").insert({ plant_id: plantId, quantity });
    if (error) return { error: error.message };
  }

  // Admin Panel §5.3 — остаток пересекает 0 → статус меняется автоматически.
  await supabase.from("plants").update({ status: quantity > 0 ? "active" : "out_of_stock" }).eq("id", plantId).eq("status", quantity > 0 ? "out_of_stock" : "active");

  revalidatePath(`/${locale}/supplier/products`);
  return {};
}

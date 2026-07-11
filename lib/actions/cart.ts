"use server";

// Мультивендорная корзина (UX Bible §8.1). Цена за единицу пересчитывается по
// ступеням prices при каждом изменении количества — Database Design §3:
// "приложение выбирает строку с максимальным min_qty ≤ запрошенное количество".

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function getBuyerCompanyId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single();
  return profile?.company_id ?? null;
}

async function getOrCreateCartId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  buyerCompanyId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("carts")
    .select("id")
    .eq("buyer_company_id", buyerCompanyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("carts")
    .insert({ buyer_company_id: buyerCompanyId })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Не удалось создать корзину");
  return created.id;
}

async function priceForQty(
  supabase: Awaited<ReturnType<typeof createClient>>,
  plantId: string,
  qty: number
): Promise<{ price: number; currency: string } | null> {
  const { data: tiers } = await supabase
    .from("prices")
    .select("min_qty, price, currency")
    .eq("plant_id", plantId)
    .order("min_qty", { ascending: false });
  const tier = (tiers ?? []).find((t) => t.min_qty <= qty) ?? tiers?.[tiers.length - 1];
  return tier ? { price: tier.price, currency: tier.currency } : null;
}

export interface CartActionResult {
  error?: string;
}

export async function addToCart(plantId: string, qty: number, locale: string): Promise<CartActionResult> {
  if (qty <= 0) return { error: "Количество должно быть больше 0" };
  const supabase = await createClient();
  const buyerCompanyId = await getBuyerCompanyId(supabase);
  if (!buyerCompanyId) return { error: "Войдите как покупатель, чтобы добавить товар в корзину" };

  const cartId = await getOrCreateCartId(supabase, buyerCompanyId);
  const tier = await priceForQty(supabase, plantId, qty);
  if (!tier) return { error: "У товара нет цены" };

  const { data: existingItem } = await supabase
    .from("cart_items")
    .select("id, qty")
    .eq("cart_id", cartId)
    .eq("plant_id", plantId)
    .maybeSingle();

  if (existingItem) {
    const newQty = existingItem.qty + qty;
    const newTier = await priceForQty(supabase, plantId, newQty);
    const { error } = await supabase
      .from("cart_items")
      .update({ qty: newQty, price_snapshot: newTier?.price ?? tier.price })
      .eq("id", existingItem.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("cart_items")
      .insert({ cart_id: cartId, plant_id: plantId, qty, price_snapshot: tier.price });
    if (error) return { error: error.message };
  }

  revalidatePath(`/${locale}/buyer/cart`);
  return {};
}

export async function updateCartItemQty(itemId: string, qty: number, locale: string): Promise<CartActionResult> {
  const supabase = await createClient();
  if (qty <= 0) {
    const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
    if (error) return { error: error.message };
    revalidatePath(`/${locale}/buyer/cart`);
    return {};
  }

  const { data: item } = await supabase.from("cart_items").select("plant_id").eq("id", itemId).single();
  if (!item?.plant_id) return { error: "Товар не найден" };
  const tier = await priceForQty(supabase, item.plant_id, qty);
  if (!tier) return { error: "У товара нет цены" };

  const { error } = await supabase
    .from("cart_items")
    .update({ qty, price_snapshot: tier.price })
    .eq("id", itemId);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/buyer/cart`);
  return {};
}

export async function removeCartItem(itemId: string, locale: string): Promise<CartActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("cart_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/${locale}/buyer/cart`);
  return {};
}

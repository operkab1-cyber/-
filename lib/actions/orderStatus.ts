"use server";

// UX Bible §5.3 — «Подтвердить»/«Отклонить» (с причиной)/«Изменить срок отгрузки».
// RLS (supplier_update_own_orders, 0002) — поставщик может обновлять только
// собственные заказы, это последний рубеж защиты, не только проверка здесь.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ORDER_STATUS_FLOW = ["new", "confirmed", "packed", "shipped", "delivered", "completed"] as const;

export interface OrderStatusResult {
  error?: string;
}

export async function advanceOrderStatus(orderId: string, nextStatusInput: string, locale: string): Promise<OrderStatusResult> {
  if (!ORDER_STATUS_FLOW.includes(nextStatusInput as (typeof ORDER_STATUS_FLOW)[number])) {
    return { error: "Недопустимый статус" };
  }
  const nextStatus = nextStatusInput as (typeof ORDER_STATUS_FLOW)[number];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { error: updateError } = await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
  if (updateError) return { error: updateError.message };

  const { data: profile } = await supabase.from("users").select("id").eq("id", user.id).single();
  const { error: historyError } = await supabase.from("order_status_history").insert({
    order_id: orderId,
    status: nextStatus,
    changed_by: profile?.id,
  });
  if (historyError) return { error: historyError.message };

  revalidatePath(`/${locale}/supplier/orders`);
  revalidatePath(`/${locale}/buyer/orders`);
  return {};
}

export async function cancelOrder(orderId: string, reason: string, locale: string): Promise<OrderStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { error: updateError } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
  if (updateError) return { error: updateError.message };

  const { data: profile } = await supabase.from("users").select("id").eq("id", user.id).single();
  const { error: historyError } = await supabase.from("order_status_history").insert({
    order_id: orderId,
    status: "cancelled",
    changed_by: profile?.id,
    note: reason,
  });
  if (historyError) return { error: historyError.message };

  revalidatePath(`/${locale}/supplier/orders`);
  revalidatePath(`/${locale}/buyer/orders`);
  return {};
}

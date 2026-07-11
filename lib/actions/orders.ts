"use server";

// Оформление заказа (UX Bible §8.2). Мультивендорная корзина → один `orders` на
// каждого поставщика, с отдельным order_number (Database Design §3 комментарий:
// "отдельный номер на поставщика при мультивендорной корзине").
//
// [решено самостоятельно / намеренно НЕ сделано] Реальная обработка платежа
// (списание по карте, SEPA, эскроу) — это ровно тот случай, который сам промпт
// называет примером необратимого решения, требующего подтверждения человека
// ("вопрос критичен для безопасности данных или необратим, например, схема
// оплаты" — правило 10). Здесь платёжный метод только фиксируется как выбор
// покупателя (orders.payment_method), реальная интеграция с платёжным шлюзом
// не реализована — заказ создаётся в статусе 'new', как будто платёж будет
// обработан отдельным шагом/оператором. Это безопасный, обратимый выбор (ничего
// не списывается), поэтому не потребовал остановки и уточнения по ходу сборки.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCartSummary } from "@/lib/queries/cart";

export interface ShippingAddress {
  recipientName: string;
  phone: string;
  country: string;
  city: string;
  street: string;
  postalCode: string;
}

export type ShippingMethod = "carrier" | "pickup" | "own_transport";
export type PaymentMethod = "card" | "invoice" | "escrow";

function shippingCostFor(method: ShippingMethod, subtotal: number): number {
  if (method !== "carrier") return 0;
  // Простая детерминированная ставка-плейсхолдер (Architecture §10.1 —
  // calculate-shipping — реальная интеграция с перевозчиками, не AI и не в MVP).
  return subtotal >= 50000 ? 0 : 1500;
}

function generateOrderNumber(supplierIndex: number): string {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `TG-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}-${supplierIndex}`;
}

export interface SubmitOrderResult {
  error?: string;
  orderNumbers?: string[];
}

export async function submitOrder(
  locale: string,
  address: ShippingAddress,
  shippingMethod: ShippingMethod,
  paymentMethod: PaymentMethod
): Promise<SubmitOrderResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Войдите, чтобы оформить заказ" };

  const { data: profile } = await supabase.from("users").select("id, company_id").eq("id", user.id).single();
  if (!profile?.company_id) return { error: "Профиль покупателя не найден" };

  const cart = await getCartSummary(locale);
  if (!cart.cartId || cart.groups.length === 0) return { error: "Корзина пуста" };
  if (cart.groups.some((g) => !g.meetsMinimum)) {
    return { error: "Не достигнут минимальный объём заказа у одного из поставщиков" };
  }

  const orderNumbers: string[] = [];

  for (let i = 0; i < cart.groups.length; i += 1) {
    const group = cart.groups[i];
    if (!group) continue;
    const shippingCost = shippingCostFor(shippingMethod, group.subtotal);
    const orderNumber = generateOrderNumber(i + 1);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        buyer_company_id: profile.company_id,
        supplier_company_id: group.companyId,
        status: "new",
        subtotal: group.subtotal,
        shipping_cost: shippingCost,
        total: group.subtotal + shippingCost,
        currency: group.currency,
        shipping_address: address as unknown as Record<string, unknown>,
        payment_method: paymentMethod,
        confirm_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return { error: orderError?.message ?? "Не удалось создать заказ" };
    }

    const orderItemsPayload = group.items.map((item) => ({
      order_id: order.id,
      plant_id: item.plantId,
      product_name_snapshot: { name: item.name, slug: item.slug },
      qty: item.qty,
      unit_price: item.unitPrice,
    }));
    const { error: itemsError } = await supabase.from("order_items").insert(orderItemsPayload);
    if (itemsError) return { error: itemsError.message };

    const { error: historyError } = await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "new",
      changed_by: profile.id,
      note: "Заказ создан покупателем",
    });
    if (historyError) return { error: historyError.message };

    orderNumbers.push(orderNumber);
  }

  // Очищаем корзину после успешного оформления.
  await supabase.from("cart_items").delete().eq("cart_id", cart.cartId);

  redirect(`/${locale}/buyer/orders?success=${orderNumbers.join(",")}`);
}

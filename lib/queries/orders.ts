import { createClient } from "@/lib/supabase/server";

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  currency: string;
  createdAt: string;
  confirmDeadline: string | null;
  counterpartyName: string;
  itemCount: number;
}

async function getCompanyAndRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("company_id, role").eq("id", user.id).single();
  return profile;
}

// UX Bible §6.2 — заказы и история покупателя.
export async function getBuyerOrders(): Promise<OrderSummary[]> {
  const supabase = await createClient();
  const profile = await getCompanyAndRole(supabase);
  if (!profile?.company_id) return [];

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, subtotal, shipping_cost, total, currency, created_at, confirm_deadline, supplier_company_id")
    .eq("buyer_company_id", profile.company_id)
    .order("created_at", { ascending: false });
  return enrichWithCounterparty(supabase, orders ?? [], "supplier_company_id");
}

// UX Bible §5.3 — заказы поставщика (канбан-подобный список статусов).
export async function getSupplierOrders(): Promise<OrderSummary[]> {
  const supabase = await createClient();
  const profile = await getCompanyAndRole(supabase);
  if (!profile?.company_id) return [];

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, subtotal, shipping_cost, total, currency, created_at, confirm_deadline, buyer_company_id")
    .eq("supplier_company_id", profile.company_id)
    .order("created_at", { ascending: false });
  return enrichWithCounterparty(supabase, orders ?? [], "buyer_company_id");
}

async function enrichWithCounterparty(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orders: {
    id: string;
    order_number: string;
    status: string;
    subtotal: number;
    shipping_cost: number;
    total: number;
    currency: string;
    created_at: string;
    confirm_deadline: string | null;
    [key: string]: unknown;
  }[],
  counterpartyKey: "supplier_company_id" | "buyer_company_id"
): Promise<OrderSummary[]> {
  if (orders.length === 0) return [];

  const companyIds = [...new Set(orders.map((o) => o[counterpartyKey] as string).filter(Boolean))];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((companies ?? []).map((c) => [c.id, c.name]));

  const orderIds = orders.map((o) => o.id);
  const { data: items } = await supabase.from("order_items").select("order_id").in("order_id", orderIds);
  const countByOrder = new Map<string, number>();
  for (const item of items ?? []) {
    countByOrder.set(item.order_id, (countByOrder.get(item.order_id) ?? 0) + 1);
  }

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    subtotal: o.subtotal,
    shippingCost: o.shipping_cost,
    total: o.total,
    currency: o.currency,
    createdAt: o.created_at,
    confirmDeadline: o.confirm_deadline,
    counterpartyName: nameById.get(o[counterpartyKey] as string) ?? "—",
    itemCount: countByOrder.get(o.id) ?? 0,
  }));
}

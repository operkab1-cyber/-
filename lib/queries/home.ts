import { createClient } from "@/lib/supabase/server";

export interface TrustNumbers {
  supplierCount: number;
  plantCount: number;
  countryCount: number;
}

// UX Bible §3.1 — "блок логотипов/цифр доверия (число поставщиков, стран,
// товаров — динамически из аналитики платформы)". "Если backend недоступен —
// статичные плейсхолдер-цифры вместо ошибки на весь экран" — обрабатывается
// вызывающей стороной через try/catch по неймингу функции ниже.
export async function getTrustNumbers(): Promise<TrustNumbers> {
  const supabase = await createClient();
  const [{ count: supplierCount }, { count: plantCount }, { data: countries }] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("verification_status", "approved"),
    supabase.from("plants").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("companies").select("country").eq("verification_status", "approved"),
  ]);

  return {
    supplierCount: supplierCount ?? 0,
    plantCount: plantCount ?? 0,
    countryCount: new Set((countries ?? []).map((c) => c.country)).size,
  };
}

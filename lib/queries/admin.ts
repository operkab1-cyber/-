import { createClient } from "@/lib/supabase/server";

export interface PendingCompany {
  id: string;
  name: string;
  type: string;
  country: string;
  createdAt: string;
}

// Очередь верификации (UX Bible §12.1) — RLS admin_all_companies (0002) уже
// гарантирует, что это видно только role='admin'; здесь просто типизированный select.
export async function getPendingCompanies(): Promise<PendingCompany[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name, type, country, created_at")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: true });

  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    country: c.country,
    createdAt: c.created_at,
  }));
}

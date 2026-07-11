import { createClient } from "@/lib/supabase/server";

export interface SupplierProfile {
  id: string;
  name: string;
  slug: string;
  country: string;
  description: string | null;
  ratingAvg: number;
  ratingCount: number;
}

// SEO Strategy §1.2/§2 — публичный профиль поставщика, /{locale}/suppliers/{slug}/.
export async function getSupplierBySlug(slug: string): Promise<SupplierProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name, slug, country, description, rating_avg, rating_count")
    .eq("slug", slug)
    .eq("verification_status", "approved")
    .single();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    country: data.country,
    description: data.description,
    ratingAvg: data.rating_avg ?? 0,
    ratingCount: data.rating_count ?? 0,
  };
}

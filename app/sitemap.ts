import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = "https://tamga.green";
const LOCALES = ["en", "ru"] as const;

function withAlternates(path: string): MetadataRoute.Sitemap[number]["alternates"] {
  return {
    languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`])),
  };
}

// SEO Strategy §4 — карта сайта. [решено самостоятельно] Документ описывает
// sitemap-индекс с чанками по 50 000 URL и отдельным файлом на локаль — при 165
// товарах это явная преждевременная оптимизация ("нужна при росте каталога", по
// тексту самого документа); один sitemap.xml с hreflang-альтернативами на каждый
// URL (Next.js MetadataRoute.Sitemap.alternates.languages) даёт тот же
// SEO-эффект без лишней инфраструктуры. Дробление на несколько файлов —
// тривиальное расширение через generateSitemaps(), когда каталог вырастет.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of LOCALES) {
    entries.push({ url: `${SITE_URL}/${locale}`, changeFrequency: "daily", priority: 1, alternates: withAlternates("") });
    entries.push({ url: `${SITE_URL}/${locale}/catalog`, changeFrequency: "daily", priority: 0.9, alternates: withAlternates("/catalog") });
  }

  const { data: categories } = await supabase.from("categories").select("slug");
  for (const category of categories ?? []) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/catalog/${category.slug}`,
        changeFrequency: "daily",
        priority: 0.8,
        alternates: withAlternates(`/catalog/${category.slug}`),
      });
    }
  }

  const { data: plants } = await supabase
    .from("plants")
    .select("slug, category_id, updated_at")
    .eq("status", "active");
  const categoryIds = [...new Set((plants ?? []).map((p) => p.category_id).filter((id): id is string => !!id))];
  const { data: categoryRows } = categoryIds.length
    ? await supabase.from("categories").select("id, slug").in("id", categoryIds)
    : { data: [] as { id: string; slug: string }[] };
  const slugByCategoryId = new Map((categoryRows ?? []).map((c) => [c.id, c.slug]));

  for (const plant of plants ?? []) {
    const categorySlug = plant.category_id ? slugByCategoryId.get(plant.category_id) : null;
    if (!categorySlug) continue;
    const path = `/catalog/${categorySlug}/${plant.slug}`;
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}${path}`,
        lastModified: plant.updated_at,
        changeFrequency: "daily",
        priority: 0.7,
        alternates: withAlternates(path),
      });
    }
  }

  const { data: companies } = await supabase.from("companies").select("slug").eq("verification_status", "approved");
  for (const company of companies ?? []) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${SITE_URL}/${locale}/suppliers/${company.slug}`,
        changeFrequency: "weekly",
        priority: 0.5,
        alternates: withAlternates(`/suppliers/${company.slug}`),
      });
    }
  }

  return entries;
}

import type { MetadataRoute } from "next";

// SEO Strategy §5.1. [решено самостоятельно] Пути в примере документа
// (/*/dashboard/, /*/cart/) — обобщённые заготовки из документа, написанного до
// реализации; реальные защищённые сегменты после Phase 2 находки про route-group
// коллизию — /supplier/, /buyer/, /admin/ (см. TODO.md, Phase 2).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/*/supplier/",
        "/*/buyer/",
        "/*/admin/",
        "/*/login",
        "/*/register",
        "/*/onboarding/",
        "/api/",
      ],
    },
    sitemap: "https://tamga.green/sitemap.xml",
  };
}

// Structured data (SEO Strategy §2) — JSON-LD, не микроразметка в HTML-атрибутах.
// Строго на провалидированных полях из БД, ничего не выдумывается (тот же принцип,
// что AI Architecture §13.4, просто применённый к SEO-разметке, а не к AI-выводу).

const SITE_URL = "https://tamga.green";

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Tamga Green",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/en/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
}

export function buildProductJsonLd(product: {
  name: string;
  description: string | null;
  images: string[];
  priceFrom: number | null;
  currency: string;
  inStock: boolean;
  url: string;
  supplierName: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? product.name,
    image: product.images,
    url: `${SITE_URL}${product.url}`,
    ...(product.priceFrom != null && {
      offers: {
        "@type": "Offer",
        priceCurrency: product.currency,
        price: String(product.priceFrom),
        availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        ...(product.supplierName && { seller: { "@type": "Organization", name: product.supplierName } }),
      },
    }),
  };
}

export function buildCollectionPageJsonLd(collection: { name: string; url: string; itemNames: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: collection.name,
    url: `${SITE_URL}${collection.url}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: collection.itemNames.slice(0, 20).map((name, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name,
      })),
    },
  };
}

// Рендерится как <script type="application/ld+json"> — компонент-обёртка живёт
// рядом (components/seo/JsonLd.tsx), эта функция только сериализует безопасно.
export function jsonLdScriptProps(data: object) {
  return { dangerouslySetInnerHTML: { __html: JSON.stringify(data) } };
}

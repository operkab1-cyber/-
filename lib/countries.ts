// Страны пилотного запуска (PRD §5.1) + KG, страна реального поставщика в seed-данных.
export const REGISTRATION_COUNTRIES: { code: string; label: string }[] = [
  { code: "NL", label: "Нидерланды" },
  { code: "BE", label: "Бельгия" },
  { code: "PL", label: "Польша" },
  { code: "DE", label: "Германия" },
  { code: "FR", label: "Франция" },
  { code: "GB", label: "Великобритания" },
  { code: "KG", label: "Кыргызстан" },
];

export const CATALOG_CATEGORY_OPTIONS: { slug: string; label: string }[] = [
  { slug: "khvoynye", label: "Хвойные" },
  { slug: "kustarniki", label: "Кустарники" },
  { slug: "derevya", label: "Деревья" },
  { slug: "travy-i-pochvopokrovnye", label: "Травы и почвопокровные" },
  { slug: "other", label: "Другое (грунты, инструменты, опоры)" },
];

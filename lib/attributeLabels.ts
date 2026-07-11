// Человекочитаемые подписи атрибутов (Plant Catalog §2 — характеристики в аккордеоне).
export const ATTRIBUTE_LABELS: Record<string, string> = {
  hardiness_zone: "Зона морозостойкости",
  light: "Освещение",
  height_range: "Высота",
  foliage_type: "Тип листвы",
  container_volume: "Объём контейнера",
  crown_form: "Форма кроны",
};

export const ENUM_VALUE_LABELS: Record<string, string> = {
  sun: "Солнце",
  partial_shade: "Полутень",
  shade: "Тень",
  evergreen: "Вечнозелёное",
  deciduous: "Листопадное",
  variegated: "Пёстролистное",
  bush: "Кустовая",
  standard: "Штамбовая",
};

export function formatAttributeValue(code: string, value: string): string {
  return ENUM_VALUE_LABELS[value] ?? value;
}

// Admin Panel §3.1 / Plant Catalog §4 — атрибут релевантен категории, если он
// глобальный (categoryId === null), привязан к самой категории, или к одному
// из её предков (ancestorIds передаётся вызывающей стороной — включает саму
// категорию). Без импортов сервера, чтобы использоваться и в клиентских
// компонентах (AddPlantWizard), и на сервере (страницы каталога).
export function isAttributeRelevant(attr: { categoryId: string | null }, ancestorIds: (string | null | undefined)[]): boolean {
  return attr.categoryId === null || ancestorIds.includes(attr.categoryId);
}

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

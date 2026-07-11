// Детерминированный шаг 1 пайплайна AI-описаний (AI Architecture §6) — портирован
// из scripts/generate-seed.mjs для runtime-использования в CMS (Phase 5, импорт
// Excel/CSV). Дублирование с generate-seed.mjs осознанное: тот скрипт запускается
// напрямую через node (не через сборку Next.js), а этот модуль — часть приложения;
// логика идентична, синхронизировать вручную при изменении одного из двух мест.

export interface ParsedAttributes {
  containerVolume: string | null;
  crownForm: "bush" | "standard";
  heightRange: string | null;
}

export function extractLatinName(name: string): string | null {
  const match = name.match(/\(([^)]+)\)\s*$/);
  if (!match) return null;
  const candidate = (match[1] ?? "").trim();
  return /^[A-Za-z][A-Za-z .'\-]*$/.test(candidate) ? candidate : null;
}

// [решено самостоятельно, найдено тестированием импорта на реальном прайсе — см.
// TODO.md, Phase 5] Раньше "снять хвостовые скобки с латынью" делалось регексом
// "скобки начинаются с латинской буквы" — но "(Co 10)"/"(Co 5)" тоже начинаются с
// латинской буквы и НЕ являются латинским названием, из-за чего они срезались
// целиком до того, как их успевал увидеть парсер объёма контейнера ("Туя западная
// Тини Тим (Co 10)" → containerVolume оставался null). Теперь скобки снимаются,
// только если extractLatinName() их действительно распознал как латынь.
function stripTrailingLatinParens(rawName: string): string {
  return extractLatinName(rawName) ? rawName.replace(/\([A-Za-z][^)]*\)\s*$/, "") : rawName;
}

export function cleanDisplayName(rawName: string): string {
  let s = stripTrailingLatinParens(rawName);
  s = s.replace(/\(\s*\d+\s*л\s*\)/gi, "");
  s = s.replace(/\(\s*[cсCС][oоOО]\s*\d+(?:\s*[-–]\s*\d+)?\s*\)/gi, "");
  s = s.replace(/[cсCС][oоOО]\s*\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+)?/gi, "");
  s = s.replace(/\bPa\b/g, "");
  s = s.replace(/ШТАМБ/gi, "");
  s = s.replace(/\d{2,3}\s*[-–]\s*\d{2,3}/g, "");
  s = s.replace(/высота\s*\d+\s*см/gi, "");
  s = s.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim();
  s = s.replace(/[-–,]+$/, "").trim();
  return s || rawName;
}

export function parseAttributes(rawName: string): ParsedAttributes {
  const withoutLatin = stripTrailingLatinParens(rawName);

  const containerMatch = withoutLatin.match(/[cсCС][oоOО]\s*(\d+(?:\s*[-–]\s*\d+)?)/);
  const literMatch = rawName.match(/\((\d+)\s*л\)/);
  let containerVolume: string | null = containerMatch?.[1]?.replace(/\s/g, "") ?? literMatch?.[1] ?? null;
  if (containerVolume && !literMatch && containerMatch) containerVolume += " л (Co)";
  else if (containerVolume && literMatch) containerVolume += " л";

  const crownForm: "bush" | "standard" = /ШТАМБ/i.test(rawName) ? "standard" : "bush";

  const explicitHeight = rawName.match(/высота\s*(\d+)\s*см/i);
  let heightRange: string | null = explicitHeight?.[1] ? `${explicitHeight[1]} см` : null;
  if (!heightRange) {
    const containerNum = containerMatch?.[1]?.replace(/\s/g, "");
    const ranges = [...withoutLatin.matchAll(/(\d{2,3})\s*[-–]\s*(\d{2,3})(?!\s*л)/g)];
    for (const r of ranges) {
      const val = `${r[1]}-${r[2]}`;
      if (val !== containerNum) {
        heightRange = `${val} см`;
        break;
      }
    }
  }

  return { containerVolume, crownForm, heightRange };
}

// Уверенность разбора (Admin Panel §7.3 — "строки с низкой уверенностью — сверху").
// Детерминированная эвристика, не LLM: высокая, если латынь и хотя бы один
// количественный атрибут распознаны; средняя, если распознано частично; низкая,
// если распознать не удалось почти ничего (короткое/нестандартное название).
export function confidenceFor(rawName: string, attrs: ParsedAttributes, latinName: string | null): "high" | "medium" | "low" {
  const signals = [attrs.containerVolume, attrs.heightRange, latinName].filter(Boolean).length;
  if (latinName && attrs.containerVolume) return "high";
  if (signals >= 1) return "medium";
  return "low";
}

export interface CategorySuggestion {
  label: string;
  confidence: "high" | "medium" | "low";
}

// Категоризация по ключевым словам (та же логика, что SUBCATEGORY_RULES в
// generate-seed.mjs) — здесь в виде плоского словаря "слово → категория" для
// произвольного импорта, не привязанного к 4 бакетам исходного plants-catalog.json.
const KEYWORD_CATEGORIES: { test: RegExp; label: string }[] = [
  { test: /туя/i, label: "Туи" },
  { test: /можжевельник/i, label: "Можжевельники" },
  { test: /тис/i, label: "Тис" },
  { test: /(^|\s)ель(\s|$)|сосна|лиственниц/i, label: "Ели и сосны" },
  { test: /барбарис/i, label: "Барбарис" },
  { test: /гортензи/i, label: "Гортензии" },
  { test: /пузыреплодник/i, label: "Пузыреплодник" },
  { test: /бересклет/i, label: "Бересклет" },
  { test: /вейгел/i, label: "Вейгела" },
  { test: /клён|клен/i, label: "Клёны" },
  { test: /граб|бук/i, label: "Граб, бук" },
  { test: /гинкго|ива/i, label: "Гинкго, ива" },
  { test: /плющ/i, label: "Почвопокровные и лианы" },
];

export function suggestCategory(rawName: string): CategorySuggestion {
  const match = KEYWORD_CATEGORIES.find((k) => k.test.test(rawName));
  if (match) return { label: match.label, confidence: "high" };
  return { label: "Требует ручной категоризации", confidence: "low" };
}

export function generateDescription({
  name,
  latinName,
  categoryLabel,
  attrs,
}: {
  name: string;
  latinName: string | null;
  categoryLabel: string;
  attrs: ParsedAttributes;
}): string {
  const displayName = cleanDisplayName(name);
  const title = latinName ? `${displayName} (лат. ${latinName})` : displayName;
  const details: string[] = [];
  if (attrs.containerVolume) details.push(`контейнер ${attrs.containerVolume}`);
  if (attrs.heightRange) details.push(`высота ${attrs.heightRange}`);
  if (attrs.crownForm === "standard") details.push("штамбовая форма");
  const detailStr = details.length ? ` — ${details.join(", ")}.` : ".";
  return `${title}${detailStr} Категория: ${categoryLabel}.`;
}

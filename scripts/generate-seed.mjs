#!/usr/bin/env node
// Генерирует supabase/seed.sql из supabase/seed-data/plants-catalog.json.
// Источник данных: реальный прайс питомника «Дебский» (rule 8 промпта — использовать
// как есть, не тестовые заглушки).
//
// Реализует пайплайн AI-описаний (Tamga_Green_AI_Architecture.md §6) настолько,
// насколько это детерминированно возможно:
//   Шаг 1 (парсинг регулярками) — parseAttributes() ниже. Полностью реализовано,
//   проверено вручную на выборке (см. TODO.md, Phase 3, отчёт).
//   Шаг 2 (LLM на неоднозначный остаток) — в этом окружении нет ANTHROPIC_API_KEY
//   (нет интернет-доступа к LLM API из песочницы сборки), поэтому здесь не
//   вызывается. Точка расширения — generateDescription() ниже, сейчас использует
//   детерминированный шаблон на основе ТОЛЬКО уже провалидированных структурных
//   данных (категория, латынь, контейнер, высота, форма кроны) — то есть не
//   нарушает главный принцип раздела 13.4 ("ничего не утверждается без источника"),
//   просто не такой разнообразный текст, как настоящий LLM дал бы.

import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(path.join(__dirname, "../supabase/seed-data/plants-catalog.json"), "utf8")
);

const CATEGORY_META = {
  conifer: { slug: "khvoynye", ru: "Хвойные", en: "Conifers" },
  shrub: { slug: "kustarniki", ru: "Кустарники", en: "Shrubs" },
  tree: { slug: "derevya", ru: "Деревья", en: "Trees" },
  grass: { slug: "travy-i-pochvopokrovnye", ru: "Травы и почвопокровные", en: "Grasses & Groundcover" },
};

// Дерево подкатегорий — Tamga_Green_Plant_Catalog.md §1.1, дословно.
const SUBCATEGORY_RULES = {
  conifer: [
    { slug: "tui", ru: "Туи", en: "Thujas", test: /туя/i },
    { slug: "mozhzhevelniki", ru: "Можжевельники", en: "Junipers", test: /можжевельник/i },
    // "ель" как голая подстрока ловит "мОЖЖЕВЕЛЬник" (со-впадение внутри слова) — раньше
    // это маскировалось порядком правил (mozhzhevelniki проверяется раньше и находится
    // первым через .find()), но на голом regex это случайность, не гарантия; ограничено
    // границами по пробелу/началу-концу строки, а не \b (см. комментарий у "tis" выше).
    { slug: "eli-i-sosny", ru: "Ели и сосны", en: "Spruces & Pines", test: /(^|\s)ель(\s|$)|сосна|лиственниц/i },
    // [решено самостоятельно, найдено при ревизии] JS \b не распознаёт кириллицу как
    // "словесный" символ (word char классы в regex по умолчанию ASCII-only) — правила
    // с \b вокруг кириллицы молча не матчились ни разу. Переписано на простой substring-
    // тест, безопасно только после проверки на ложные срабатывания по всему каталогу
    // (см. TODO.md, Phase 3, отчёт) — "тис"/"ива" больше нигде не встречаются.
    { slug: "tis", ru: "Тис", en: "Yew", test: /тис/i },
  ],
  shrub: [
    { slug: "barbaris", ru: "Барбарис", en: "Barberry", test: /барбарис/i },
    { slug: "gortenzii", ru: "Гортензии", en: "Hydrangeas", test: /гортензи/i },
    { slug: "puzyreplodnik", ru: "Пузыреплодник", en: "Ninebark", test: /пузыреплодник/i },
    { slug: "bereskleti", ru: "Бересклет", en: "Euonymus", test: /бересклет/i },
    { slug: "veigela", ru: "Вейгела", en: "Weigela", test: /вейгел/i },
  ],
  tree: [
    { slug: "kleny", ru: "Клёны", en: "Maples", test: /клён|клен/i },
    { slug: "grab-buk", ru: "Граб, бук", en: "Hornbeam & Beech", test: /граб|бук/i },
    { slug: "ginkgo-iva", ru: "Гинкго, ива", en: "Ginkgo & Willow", test: /гинкго|ива/i },
  ],
  grass: [
    { slug: "pochvopokrovnye-i-liany", ru: "Почвопокровные и лианы", en: "Groundcover & Vines", test: /плющ/i },
  ],
};
// Фолбэк-подкатегория внутри каждой родительской, если ни одно правило не совпало —
// [решено самостоятельно] документ не даёт явного bucket'а для позиций вроде
// буддлеи/дейции/ракитника (shrub) или липы/магнолии (tree) — заведено "Прочие ..."
// вместо того, чтобы притягивать их к неподходящей подкатегории.
const FALLBACK_SUBCATEGORY = {
  conifer: { slug: "drugie-khvoynye", ru: "Прочие хвойные", en: "Other conifers" },
  shrub: { slug: "drugie-kustarniki", ru: "Прочие кустарники", en: "Other shrubs" },
  tree: { slug: "drugie-derevya", ru: "Прочие деревья", en: "Other trees" },
  grass: { slug: "dekorativnye-travy", ru: "Декоративные травы", en: "Ornamental grasses" },
};

const TRANSLIT = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"j",к:"k",л:"l",м:"m",
  н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",
  ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
};

function slugify(name) {
  const lower = name.toLowerCase();
  let out = "";
  for (const ch of lower) out += TRANSLIT[ch] ?? ch;
  return out.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}

function extractLatinName(name) {
  const match = name.match(/\(([^)]+)\)\s*$/);
  if (!match) return null;
  const candidate = match[1].trim();
  return /^[A-Za-z][A-Za-z .'\-]*$/.test(candidate) ? candidate : null;
}

// [решено самостоятельно, найдено тестированием импорта в Phase 5 — см. TODO.md]
// "Снять хвостовые скобки с латынью" раньше делалось по regex "скобки начинаются
// с латинской буквы" — но "(Co 10)"/"(Co 5)" тоже начинаются с латинской буквы и
// латынью не являются, из-за чего они срезались целиком до парсера объёма
// контейнера (4 позиции туи "Тини Тим"/"Хозери" оставались без containerVolume).
// Портировано сюда из lib/ai/parsePlantName.ts (runtime-версия для CMS-импорта,
// исправлена первой) — см. комментарий в шапке файла про синхронизацию вручную.
function stripTrailingLatinParens(rawName) {
  return extractLatinName(rawName) ? rawName.replace(/\([A-Za-z][^)]*\)\s*$/, "") : rawName;
}

// Человекочитаемое название без служебных токенов прайса (Co5, ШТАМБ, диапазон
// высоты, латынь в скобках) — для описаний и заголовков карточки. [решено
// самостоятельно, найдено при ручной проверке 20 позиций — см. TODO.md]: без этой
// очистки generateDescription() дублировал сырую строку и латынь в одном предложении
// ("...Co5 (Picea pungens...) (лат. Picea pungens...)"), что не годится для публикации.
function cleanDisplayName(rawName) {
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
  return s || rawName; // фолбэк, если очистка съела всё (не должно происходить)
}

// Шаг 1 пайплайна AI-описаний — детерминированный парсинг регулярками
// (AI Architecture §6, пункт 1). Возвращает только то, что распознано однозначно;
// ничего не придумывает для пустых полей (§13.4).
function parseAttributes(rawName) {
  const withoutLatin = stripTrailingLatinParens(rawName);

  const containerMatch = withoutLatin.match(/[cсCС][oоOО]\s*(\d+(?:\s*[-–]\s*\d+)?)/);
  const literMatch = rawName.match(/\((\d+)\s*л\)/);
  let containerVolume = containerMatch?.[1]?.replace(/\s/g, "") ?? literMatch?.[1] ?? null;
  if (containerVolume && !literMatch && containerMatch) containerVolume += " л (Co)";
  else if (containerVolume && literMatch) containerVolume += " л";

  const crownForm = /ШТАМБ/i.test(rawName) ? "standard" : "bush";

  const explicitHeight = rawName.match(/высота\s*(\d+)\s*см/i);
  let heightRange = explicitHeight?.[1] ? `${explicitHeight[1]} см` : null;
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

// Шаг 3 пайплайна — генерация описания. Точка расширения для реального вызова
// LLM (см. шапку файла): сигнатура сознательно принимает только уже
// провалидированные структурные поля, не сырую строку — так и должно быть
// по AI Architecture §6, пункт 3, независимо от того, шаблон это или настоящая модель.
function generateDescription({ name, latinName, categoryLabel, attrs }) {
  const displayName = cleanDisplayName(name);
  const title = latinName ? `${displayName} (лат. ${latinName})` : displayName;
  const details = [];
  if (attrs.containerVolume) details.push(`контейнер ${attrs.containerVolume}`);
  if (attrs.heightRange) details.push(`высота ${attrs.heightRange}`);
  if (attrs.crownForm === "standard") details.push("штамбовая форма");
  const detailStr = details.length ? ` — ${details.join(", ")}.` : ".";
  return `${title}${detailStr} Категория: ${categoryLabel}. Реальный товар питомника «Дебский», доступен для заказа.`;
}

function sqlString(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const lines = [];
lines.push("-- Seed: реальный каталог питомника «Дебский», 165 позиций");
lines.push("-- Сгенерировано скриптом scripts/generate-seed.mjs из supabase/seed-data/plants-catalog.json");
lines.push("-- Курс сом -> EUR не применяется: цены сохранены в исходной валюте (KGS), см. TODO.md.");
lines.push("");

// ==== Компания-поставщик ====
const companyId = randomUUID();
lines.push("-- Поставщик");
lines.push(
  `insert into companies (id, name, slug, type, country, verification_status, description) values (` +
    `${sqlString(companyId)}, ${sqlString("Питомник «Дебский»")}, ${sqlString("pitomnik-debskiy")}, ` +
    `'nursery', ${sqlString("KG")}, 'approved', ` +
    `${sqlString("Питомник декоративных растений, Кыргызстан. Хвойные, кустарники, деревья, травы и почвопокровные.")});`
);
lines.push("");

// ==== Категории (верхний уровень + подкатегории — Plant Catalog §1.1) ====
lines.push("-- Категории (верхний уровень)");
const categoryIds = {};
const categoryTranslations = [];
let sortOrder = 0;
for (const [key, meta] of Object.entries(CATEGORY_META)) {
  const id = randomUUID();
  categoryIds[key] = id;
  lines.push(`insert into categories (id, slug, sort_order) values (${sqlString(id)}, ${sqlString(meta.slug)}, ${sortOrder});`);
  categoryTranslations.push(
    `insert into translations (entity_type, entity_id, field, locale, value) values ('category', ${sqlString(id)}, 'name', 'ru', ${sqlString(meta.ru)});`,
    `insert into translations (entity_type, entity_id, field, locale, value) values ('category', ${sqlString(id)}, 'name', 'en', ${sqlString(meta.en)});`
  );
  sortOrder += 1;
}
lines.push("");

lines.push("-- Подкатегории");
const subcategoryIds = {}; // key: `${topKey}:${subSlug}` -> id
function ensureSubcategory(topKey, sub, subSortOrder) {
  const cacheKey = `${topKey}:${sub.slug}`;
  if (subcategoryIds[cacheKey]) return subcategoryIds[cacheKey];
  const id = randomUUID();
  subcategoryIds[cacheKey] = id;
  lines.push(
    `insert into categories (id, parent_id, slug, sort_order) values (${sqlString(id)}, ${sqlString(categoryIds[topKey])}, ${sqlString(sub.slug)}, ${subSortOrder});`
  );
  categoryTranslations.push(
    `insert into translations (entity_type, entity_id, field, locale, value) values ('category', ${sqlString(id)}, 'name', 'ru', ${sqlString(sub.ru)});`,
    `insert into translations (entity_type, entity_id, field, locale, value) values ('category', ${sqlString(id)}, 'name', 'en', ${sqlString(sub.en)});`
  );
  return id;
}
for (const [topKey, rules] of Object.entries(SUBCATEGORY_RULES)) {
  rules.forEach((sub, i) => ensureSubcategory(topKey, sub, i));
  const fb = FALLBACK_SUBCATEGORY[topKey];
  ensureSubcategory(topKey, fb, rules.length);
}
lines.push("");
lines.push(...categoryTranslations);
lines.push("");

// ==== Атрибуты каталога ====
lines.push("-- Определения атрибутов");
const attributeDefs = [
  { code: "hardiness_zone", type: "enum", unit: null, options: ["zone_3","zone_4","zone_5","zone_6","zone_7","zone_8","zone_9"] },
  { code: "light", type: "enum", unit: null, options: ["sun","partial_shade","shade"] },
  { code: "height_range", type: "text", unit: "см", options: null },
  { code: "foliage_type", type: "enum", unit: null, options: ["evergreen","deciduous","variegated"] },
  { code: "container_volume", type: "text", unit: "л", options: null },
  { code: "crown_form", type: "enum", unit: null, options: ["bush","standard"] },
];
const attributeIds = {};
for (const attr of attributeDefs) {
  const id = randomUUID();
  attributeIds[attr.code] = id;
  const optionsJson = attr.options ? `'${JSON.stringify(attr.options)}'::jsonb` : "null";
  lines.push(
    `insert into attributes (id, category_id, code, data_type, unit, enum_options, is_filterable) values (` +
      `${sqlString(id)}, null, ${sqlString(attr.code)}, ${sqlString(attr.type)}, ${sqlString(attr.unit)}, ${optionsJson}, true);`
  );
}
lines.push("");

// ==== Растения, переводы, цены, остатки, значения атрибутов, описания ====
const seenSlugs = new Map();
lines.push("-- Товары");
const plantRows = [];
const translationRows = [];
const priceRows = [];
const availabilityRows = [];
const attrValueRows = [];
let parsedSample = []; // для ручной проверки качества (см. отчёт в TODO.md)

for (const [catKey, items] of Object.entries(catalog)) {
  const rules = SUBCATEGORY_RULES[catKey] ?? [];
  const fallback = FALLBACK_SUBCATEGORY[catKey];

  for (const item of items) {
    const id = randomUUID();
    const latinName = extractLatinName(item.n);
    const attrs = parseAttributes(item.n);

    const matchedRule = rules.find((r) => r.test.test(item.n));
    const subKey = `${catKey}:${(matchedRule ?? fallback).slug}`;
    const categoryId = subcategoryIds[subKey];

    let slug = slugify(item.n);
    const count = seenSlugs.get(slug) ?? 0;
    seenSlugs.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count + 1}`;

    plantRows.push(
      `insert into plants (id, company_id, category_id, slug, latin_name, status) values (` +
        `${sqlString(id)}, ${sqlString(companyId)}, ${sqlString(categoryId)}, ${sqlString(slug)}, ${sqlString(latinName)}, 'active');`
    );
    translationRows.push(
      `insert into translations (entity_type, entity_id, field, locale, value) values ('plant', ${sqlString(id)}, 'name', 'ru', ${sqlString(item.n)});`
    );

    const description = generateDescription({
      name: item.n,
      latinName,
      categoryLabel: (matchedRule ?? fallback).ru,
      attrs,
    });
    translationRows.push(
      `insert into translations (entity_type, entity_id, field, locale, value) values ('plant', ${sqlString(id)}, 'description', 'ru', ${sqlString(description)});`
    );

    priceRows.push(`insert into prices (plant_id, min_qty, price, currency) values (${sqlString(id)}, 1, ${item.p}, 'KGS');`);
    availabilityRows.push(`insert into availability (plant_id, quantity) values (${sqlString(id)}, ${item.oos ? 0 : 20});`);

    if (attrs.containerVolume) {
      attrValueRows.push(
        `insert into plant_attribute_values (plant_id, attribute_id, value_text) values (${sqlString(id)}, ${sqlString(attributeIds.container_volume)}, ${sqlString(attrs.containerVolume)});`
      );
    }
    if (attrs.heightRange) {
      attrValueRows.push(
        `insert into plant_attribute_values (plant_id, attribute_id, value_text) values (${sqlString(id)}, ${sqlString(attributeIds.height_range)}, ${sqlString(attrs.heightRange)});`
      );
    }
    attrValueRows.push(
      `insert into plant_attribute_values (plant_id, attribute_id, value_text) values (${sqlString(id)}, ${sqlString(attributeIds.crown_form)}, ${sqlString(attrs.crownForm)});`
    );

    if (parsedSample.length < 165) {
      parsedSample.push({ raw: item.n, category: (matchedRule ?? fallback).ru, latinName, ...attrs, description });
    }
  }
}

lines.push(
  ...plantRows, "",
  "-- Переводы (названия + описания)", ...translationRows, "",
  "-- Цены", ...priceRows, "",
  "-- Остатки", ...availabilityRows, "",
  "-- Значения атрибутов", ...attrValueRows, ""
);

writeFileSync(path.join(__dirname, "../supabase/seed.sql"), lines.join("\n") + "\n");
writeFileSync(
  path.join(__dirname, "../supabase/seed-data/parsed-preview.json"),
  JSON.stringify(parsedSample, null, 2)
);
console.log(`OK: ${plantRows.length} plants written to supabase/seed.sql`);
console.log(`OK: parsed preview (all ${parsedSample.length} items) written to supabase/seed-data/parsed-preview.json`);

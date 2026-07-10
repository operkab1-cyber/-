#!/usr/bin/env node
// Генерирует supabase/seed.sql из supabase/seed-data/plants-catalog.json.
// Источник данных: реальный прайс питомника «Дебский» (rule 8 промпта — использовать
// как есть, не тестовые заглушки). Разбор в атрибуты (объём контейнера/высота/форма
// кроны) — отдельный AI-пайплайн из Tamga_Green_AI_Architecture.md §6, делается на
// Phase 3, а не здесь: этот скрипт заполняет только то, что можно извлечь надёжно и
// детерминированно (латинское название из скобок) плюс базовые цена/остаток/перевод.

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

const TRANSLIT = {
  а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"j",к:"k",л:"l",м:"m",
  н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"c",ч:"ch",ш:"sh",щ:"sch",
  ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
};

function slugify(name) {
  const lower = name.toLowerCase();
  let out = "";
  for (const ch of lower) {
    out += TRANSLIT[ch] ?? ch;
  }
  return out
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

// Латинское название — только если содержимое скобок целиком латиница/пробелы/апострофы/
// дефисы (отсекает контейнеры вида "(2 л)"/"(5 л)", которые тоже в скобках, но не латынь).
function extractLatinName(name) {
  const match = name.match(/\(([^)]+)\)\s*$/);
  if (!match) return null;
  const candidate = match[1].trim();
  return /^[A-Za-z][A-Za-z .'\-]*$/.test(candidate) ? candidate : null;
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

// ==== Компания-поставщик (реальный питомник, не тестовая заглушка — rule 8) ====
const companyId = randomUUID();
lines.push("-- Поставщик");
lines.push(
  `insert into companies (id, name, slug, type, country, verification_status, description) values (` +
    `${sqlString(companyId)}, ${sqlString("Питомник «Дебский»")}, ${sqlString("pitomnik-debskiy")}, ` +
    `'nursery', ${sqlString("KG")}, 'approved', ` +
    `${sqlString("Питомник декоративных растений, Кыргызстан. Хвойные, кустарники, деревья, травы и почвопокровные.")});`
);
lines.push("");

// ==== Категории (+ переводы названий ru/en) ====
lines.push("-- Категории");
const categoryIds = {};
let sortOrder = 0;
for (const [key, meta] of Object.entries(CATEGORY_META)) {
  const id = randomUUID();
  categoryIds[key] = id;
  lines.push(
    `insert into categories (id, slug, sort_order) values (${sqlString(id)}, ${sqlString(meta.slug)}, ${sortOrder});`
  );
  sortOrder += 1;
}
lines.push("");
lines.push("-- Переводы названий категорий");
for (const [key, meta] of Object.entries(CATEGORY_META)) {
  const id = categoryIds[key];
  lines.push(
    `insert into translations (entity_type, entity_id, field, locale, value) values ('category', ${sqlString(id)}, 'name', 'ru', ${sqlString(meta.ru)});`
  );
  lines.push(
    `insert into translations (entity_type, entity_id, field, locale, value) values ('category', ${sqlString(id)}, 'name', 'en', ${sqlString(meta.en)});`
  );
}
lines.push("");

// ==== Атрибуты каталога (Plant Catalog §2 — зона морозостойкости, освещение, высота/
// ширина, тип листвы, объём контейнера, форма кроны). category_id = null — общие для
// всех растений на MVP; значения по конкретным товарам заполняются в Phase 3 (AI-пайплайн). ====
lines.push("-- Определения атрибутов (значения по товарам — Phase 3, AI Architecture §6)");
const attributeDefs = [
  { code: "hardiness_zone", type: "enum", unit: null, options: ["zone_3","zone_4","zone_5","zone_6","zone_7","zone_8","zone_9"] },
  { code: "light", type: "enum", unit: null, options: ["sun","partial_shade","shade"] },
  { code: "height_range", type: "text", unit: "см", options: null },
  { code: "foliage_type", type: "enum", unit: null, options: ["evergreen","deciduous","variegated"] },
  { code: "container_volume", type: "text", unit: "л", options: null },
  { code: "crown_form", type: "enum", unit: null, options: ["bush","standard"] },
];
for (const attr of attributeDefs) {
  const id = randomUUID();
  const optionsJson = attr.options ? `'${JSON.stringify(attr.options)}'::jsonb` : "null";
  lines.push(
    `insert into attributes (id, category_id, code, data_type, unit, enum_options, is_filterable) values (` +
      `${sqlString(id)}, null, ${sqlString(attr.code)}, ${sqlString(attr.type)}, ${sqlString(attr.unit)}, ${optionsJson}, true);`
  );
}
lines.push("");

// ==== Растения, переводы, цены, остатки ====
const seenSlugs = new Map();
lines.push("-- Товары");
const plantRows = [];
const priceRows = [];
const translationRows = [];
const availabilityRows = [];

for (const [catKey, items] of Object.entries(catalog)) {
  const categoryId = categoryIds[catKey];
  for (const item of items) {
    const id = randomUUID();
    const latinName = extractLatinName(item.n);
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
    priceRows.push(
      `insert into prices (plant_id, min_qty, price, currency) values (${sqlString(id)}, 1, ${item.p}, 'KGS');`
    );
    availabilityRows.push(
      `insert into availability (plant_id, quantity) values (${sqlString(id)}, ${item.oos ? 0 : 20});`
    );
  }
}

lines.push(...plantRows, "", "-- Переводы названий товаров", ...translationRows, "", "-- Цены", ...priceRows, "", "-- Остатки", ...availabilityRows, "");

writeFileSync(path.join(__dirname, "../supabase/seed.sql"), lines.join("\n") + "\n");
console.log(`OK: ${plantRows.length} plants written to supabase/seed.sql`);

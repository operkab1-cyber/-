// AI Architecture §12: "AI нужен только на входе: превратить «участок
// примерно 6 соток, забор буквой Г» в структурированные метры периметра".
// §13.3: "дешёвые детерминированные шаги (парсинг регулярками...) выполняются
// в первую очередь — LLM вызывается только на то, что действительно требует
// понимания языка". Это Шаг 1 того же пайплайна, что parsePlantName.ts
// (Phase 3) — надёжно вытаскивает то, что вытаскивается регулярками (площадь
// в сотках/м², длина в метрах, тип посадки по ключевым словам), а не
// произвольный текст любой формы ("забор буквой Г" саму геометрию не
// распознаёт — для этого нужен реальный LLM-вызов, которого нет без
// ANTHROPIC_API_KEY, см. TODO.md). Поэтому в интерфейсе это подписано как
// "быстрый ввод текстом", а не выдаётся за AI-функцию.

export type PlantingTypeGuess = "hedge" | "bed" | "roof" | null;

export interface ParsedGardenInput {
  type: PlantingTypeGuess;
  length: number | null; // метры (изгородь) либо м² (клумба/кровля) — та же двойная семантика поля, что в VolumeCalculator
  matched: string[]; // что именно распознано — показывается пользователю для проверки перед применением
  unmatched: string[]; // что не удалось распознать — тоже показывается, чтобы не выдавать частичный разбор за полный
}

const SOTKA_TO_M2 = 100;

function matchSotka(text: string): { value: number; fragment: string } | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*сот(?:ок|ка|ки)/);
  if (!m || !m[1]) return null;
  return { value: parseFloat(m[1].replace(",", ".")) * SOTKA_TO_M2, fragment: m[0] };
}

function matchSquareMeters(text: string): { value: number; fragment: string } | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:м²|кв\.?\s?м\.?|квадратных\s?метров)/);
  if (!m || !m[1]) return null;
  return { value: parseFloat(m[1].replace(",", ".")), fragment: m[0] };
}

function matchLinearMeters(text: string): { value: number; fragment: string } | null {
  // [найдено живым тестом] JS `\b` не считает кириллицу словообразующим
  // символом (`\w` = только ASCII) — "м\b" в конце строки после кириллицы
  // (например "40м" в конце фразы) молча не матчится. Тот же класс бага, что
  // уже был найден и исправлен в Phase 3 (категорийные regex-правила
  // "Тис"/"Гинкго, ива"). Здесь — негативный lookahead на кириллицу вместо \b.
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:метров|метра|метр|м(?![а-яё]))/);
  if (!m || !m[1]) return null;
  return { value: parseFloat(m[1].replace(",", ".")), fragment: m[0] };
}

export function parseGardenText(raw: string): ParsedGardenInput {
  const text = raw.toLowerCase();
  const matched: string[] = [];
  const unmatched: string[] = [];
  let type: PlantingTypeGuess = null;

  if (/изгород/.test(text)) {
    type = "hedge";
    matched.push("тип посадки: живая изгородь");
  } else if (/клумб/.test(text)) {
    type = "bed";
    matched.push("тип посадки: клумба");
  } else if (/кровл|крыш/.test(text)) {
    type = "roof";
    matched.push("тип посадки: озеленение кровли");
  } else {
    unmatched.push("тип посадки (изгородь/клумба/кровля) — укажите вручную");
  }

  let length: number | null = null;

  if (type === "hedge") {
    // Для изгороди нужна длина, а не площадь участка — площадь в сотках/м² здесь
    // не то же самое, что периметр забора, поэтому её не подставляем.
    const linear = matchLinearMeters(text);
    if (linear) {
      length = linear.value;
      matched.push(`длина: «${linear.fragment}» → ${linear.value} м`);
    } else {
      unmatched.push("длина ограждения в метрах — укажите вручную");
    }
  } else if (type === "bed" || type === "roof") {
    const sotka = matchSotka(text);
    const sqm = sotka ?? matchSquareMeters(text);
    if (sqm) {
      length = sqm.value;
      matched.push(`площадь: «${sqm.fragment}» → ${sqm.value} м²`);
    } else {
      unmatched.push("площадь в сотках или м² — укажите вручную");
    }
  } else {
    // Тип не распознан — берём любое число с единицей измерения, чтобы хоть
    // что-то подставить, пользователь всё равно выбирает тип вручную.
    const anyMatch = matchSotka(text) ?? matchSquareMeters(text) ?? matchLinearMeters(text);
    if (anyMatch) {
      length = anyMatch.value;
      matched.push(`число: «${anyMatch.fragment}» → ${anyMatch.value}`);
    }
  }

  return { type, length, matched, unmatched };
}

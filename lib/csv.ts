// Простой CSV-парсер для импорта прайса (Admin Panel §7). [решено самостоятельно]
// Поддержан только .csv, не бинарный .xlsx — в песочнице сборки нет удобного пути
// протестировать парсинг реального .xlsx без дополнительной тяжёлой зависимости
// (sheetjs и т.п.), а сам прайс-лист поставщика по структуре ("НАЗВАНИЕ", "Цена",
// колонка без явного заголовка под отметку "нет в наличии") воспроизводим и в CSV.
// Добавить .xlsx — тривиальное расширение (та же таблица маппинга колонок), см. TODO.md.
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  function parseLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    cells.push(current);
    return cells.map((c) => c.trim());
  }

  const [headerLine, ...rest] = lines;
  return {
    headers: parseLine(headerLine ?? ""),
    rows: rest.map(parseLine),
  };
}

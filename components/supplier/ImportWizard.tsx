"use client";

import { useState } from "react";
import { parseCsv } from "@/lib/csv";
import { parseAttributes, extractLatinName, cleanDisplayName, confidenceFor, suggestCategory } from "@/lib/ai/parsePlantName";
import { confirmImport, type ImportRow } from "@/lib/actions/import";
import { Button } from "@/components/ui/Button";
import type { CatalogCategory } from "@/lib/queries/catalog";

type ColumnRole = "name" | "price" | "oos_marker" | "ignore";

interface PreviewRow {
  rawName: string;
  price: number;
  outOfStock: boolean;
  latinName: string | null;
  cleanName: string;
  attrs: ReturnType<typeof parseAttributes>;
  confidence: "high" | "medium" | "low";
  suggestedCategoryLabel: string;
  categoryId: string;
}

// Admin Panel §7 — самый важный флоу CMS. 4 шага: загрузка → сопоставление колонок
// → AI-разбор с таблицей "было/стало" → финальное подтверждение (создаёт черновики).
export function ImportWizard({ locale, categories }: { locale: string; categories: CatalogCategory[] }) {
  const [step, setStep] = useState(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [columnRoles, setColumnRoles] = useState<ColumnRole[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function guessRole(header: string): ColumnRole {
    const h = header.toLowerCase();
    if (h.includes("назв") || h.includes("name")) return "name";
    if (h.includes("цен") || h.includes("price")) return "price";
    if (h.trim() === "" || h.startsWith("unnamed")) return "oos_marker";
    return "ignore";
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { headers: h, rows } = parseCsv(String(reader.result));
      setHeaders(h);
      setRawRows(rows);
      setColumnRoles(h.map(guessRole));
      setStep(2);
    };
    reader.readAsText(file, "utf-8");
  }

  function buildPreview() {
    const nameIdx = columnRoles.indexOf("name");
    const priceIdx = columnRoles.indexOf("price");
    const oosIdx = columnRoles.indexOf("oos_marker");
    if (nameIdx === -1 || priceIdx === -1) {
      setError("Укажите, какая колонка — название, а какая — цена");
      return;
    }
    setError(null);

    const rows: PreviewRow[] = rawRows
      .filter((r) => r[nameIdx]?.trim())
      .map((r) => {
        const rawName = (r[nameIdx] ?? "").trim();
        const price = Number(String(r[priceIdx] ?? "0").replace(/[^\d.]/g, "")) || 0;
        const outOfStock = oosIdx >= 0 && /нет в наличии/i.test(r[oosIdx] ?? "");
        const latinName = extractLatinName(rawName);
        const attrs = parseAttributes(rawName);
        const suggestion = suggestCategory(rawName);
        const matchedCategory = categories.find((c) => c.name.toLowerCase() === suggestion.label.toLowerCase());
        return {
          rawName,
          price,
          outOfStock,
          latinName,
          cleanName: cleanDisplayName(rawName),
          attrs,
          confidence: confidenceFor(rawName, attrs, latinName),
          suggestedCategoryLabel: suggestion.label,
          categoryId: matchedCategory?.id ?? "uncategorized",
        };
      })
      // низкая уверенность — сверху (Admin Panel §7.3).
      .sort((a, b) => {
        const order = { low: 0, medium: 1, high: 2 };
        return order[a.confidence] - order[b.confidence];
      });

    setPreview(rows);
    setStep(3);
  }

  function updateCategory(index: number, categoryId: string) {
    setPreview((prev) => prev.map((r, i) => (i === index ? { ...r, categoryId } : r)));
  }

  async function handleConfirm() {
    setPending(true);
    setError(null);
    const payload: ImportRow[] = preview.map((r) => ({
      rawName: r.rawName,
      price: r.price,
      outOfStock: r.outOfStock,
      categoryId: r.categoryId,
      categoryLabel: r.suggestedCategoryLabel,
    }));
    const res = await confirmImport(payload, locale);
    setPending(false);
    if (res.error) setError(res.error);
    else setResult({ created: res.created ?? 0, updated: res.updated ?? 0 });
  }

  if (result) {
    return (
      <div className="rounded-lg border border-sap bg-sprout-bg p-6">
        <p className="font-body text-[14px] font-semibold text-canopy">Импорт завершён</p>
        <p className="mt-2 font-body text-[13.5px] text-ink">
          Создано черновиков: {result.created}. Обновлено существующих (по совпадению slug): {result.updated}.
        </p>
        <p className="mt-2 font-body text-[12.5px] text-ink-muted">
          Черновики не опубликованы автоматически — откройте «Каталог», проверьте и опубликуйте позиции с ⚠.
        </p>
      </div>
    );
  }

  return (
    <div>
      {step === 1 && (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center">
          <p className="mb-3 font-body text-[13.5px] text-ink-muted">Загрузите .csv с прайсом (кодировка UTF-8)</p>
          <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        </div>
      )}

      {step === 2 && (
        <div className="rounded-lg border border-border bg-white p-4">
          <p className="mb-3 font-body text-[13.5px] font-semibold text-ink">Сопоставление колонок</p>
          <table className="w-full font-body text-[12.5px]">
            <thead>
              <tr className="text-left text-ink-muted">
                <th className="p-2">Колонка в файле</th>
                <th className="p-2">Пример</th>
                <th className="p-2">Поле в каталоге</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((h, i) => (
                <tr key={i} className="border-t border-dashed border-border">
                  <td className="p-2 font-mono">{h || "(без названия)"}</td>
                  <td className="p-2 text-ink-muted">{rawRows[0]?.[i]}</td>
                  <td className="p-2">
                    <select
                      value={columnRoles[i]}
                      onChange={(e) =>
                        setColumnRoles((prev) => prev.map((r, idx) => (idx === i ? (e.target.value as ColumnRole) : r)))
                      }
                      className="rounded-sm border border-border px-2 py-1"
                    >
                      <option value="name">Название</option>
                      <option value="price">Цена</option>
                      <option value="oos_marker">Отметка &quot;нет в наличии&quot;</option>
                      <option value="ignore">Игнорировать</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {error && <p className="mt-2 font-body text-[12.5px] text-error">{error}</p>}
          <div className="mt-4 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Назад
            </Button>
            <Button onClick={buildPreview}>Разобрать</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="mb-3 font-body text-[13.5px] text-ink-muted">
            {preview.length} строк. Низкая уверенность — сверху, проверьте категорию перед импортом.
          </p>
          <div className="max-h-[500px] overflow-y-auto rounded-lg border border-border bg-white">
            <table className="w-full font-body text-[12.5px]">
              <thead className="sticky top-0 bg-paper-deep">
                <tr className="text-left text-ink-muted">
                  <th className="p-2">Было</th>
                  <th className="p-2">Стало</th>
                  <th className="p-2">Уверенность</th>
                  <th className="p-2">Категория</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className={"border-t border-dashed border-border " + (r.confidence === "low" ? "bg-error-bg/40" : r.confidence === "medium" ? "bg-stamp-bg/40" : "")}>
                    <td className="p-2 font-mono text-[11.5px] text-ink-muted">{r.rawName}</td>
                    <td className="p-2">
                      {r.cleanName}
                      {r.latinName && <span className="italic text-ink-muted"> · {r.latinName}</span>}
                      {r.outOfStock && <span className="ml-1 text-error">(нет в наличии)</span>}
                    </td>
                    <td className="p-2">{r.confidence === "high" ? "✅ высокая" : r.confidence === "medium" ? "⚠ средняя" : "⚠ низкая"}</td>
                    <td className="p-2">
                      <select
                        value={r.categoryId}
                        onChange={(e) => updateCategory(i, e.target.value)}
                        className="rounded-sm border border-border px-1.5 py-1"
                      >
                        <option value="uncategorized">Без категории</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.parentId ? `— ${c.name}` : c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="mt-2 font-body text-[12.5px] text-error">{error}</p>}
          <div className="mt-4 flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)} disabled={pending}>
              Назад
            </Button>
            <Button loading={pending} onClick={handleConfirm}>
              Импортировать ({preview.length} товаров как черновики)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

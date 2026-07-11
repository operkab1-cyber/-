"use client";

import { useState } from "react";
import {
  previewBulkUpdate,
  applyBulkUpdate,
  rollbackBulkPriceUpdate,
  type BulkField,
  type BulkOp,
  type BulkPreviewRow,
  type RecentBulkPriceUpdate,
} from "@/lib/actions/bulkUpdate";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import type { CatalogCategory } from "@/lib/queries/catalog";

// Admin Panel §4.2/§5.4 — предпросмотр "до/после" по первым 10 позициям перед
// применением ко всем.
export function BulkUpdateWizard({
  locale,
  categories,
  recentRollbacks,
}: {
  locale: string;
  categories: CatalogCategory[];
  recentRollbacks: RecentBulkPriceUpdate[];
}) {
  const [field, setField] = useState<BulkField>("price");
  const [op, setOp] = useState<BulkOp>("percent");
  const [amount, setAmount] = useState(5);
  const [categoryId, setCategoryId] = useState<string>("");
  const [preview, setPreview] = useState<BulkPreviewRow[] | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rollbacks, setRollbacks] = useState(recentRollbacks);
  const [rollbackPending, setRollbackPending] = useState<string | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [rollbackDone, setRollbackDone] = useState<string | null>(null);

  async function handleRollback(auditLogId: string) {
    setRollbackPending(auditLogId);
    setRollbackError(null);
    const res = await rollbackBulkPriceUpdate(auditLogId, locale);
    setRollbackPending(null);
    if (res.error) {
      setRollbackError(res.error);
      return;
    }
    setRollbacks((prev) => prev.filter((r) => r.auditLogId !== auditLogId));
    setRollbackDone(`Откачено ${res.reverted} товаров.`);
  }

  async function handlePreview() {
    setPending(true);
    setError(null);
    const rows = await previewBulkUpdate(field, op, amount, categoryId || null);
    setPending(false);
    setPreview(rows);
  }

  async function handleApply() {
    setPending(true);
    setError(null);
    const res = await applyBulkUpdate(field, op, amount, categoryId || null, locale);
    setPending(false);
    if (res.error) setError(res.error);
    else setResult(res.affected ?? 0);
  }

  if (result !== null) {
    return (
      <div className="rounded-lg border border-sap bg-sprout-bg p-6">
        <p className="font-body text-[14px] text-canopy">Изменено {result} товаров. Действие записано в журнал (audit_log).</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {(rollbacks.length > 0 || rollbackDone) && (
        <div className="rounded-lg border border-border bg-white p-5">
          <p className="mb-3 font-body text-[13px] font-semibold text-ink">
            Недавние массовые изменения цен <span className="font-normal text-ink-muted">(откат доступен 24 часа)</span>
          </p>
          {rollbackDone && <p className="mb-2 font-body text-[13px] text-sap">{rollbackDone}</p>}
          {rollbackError && <p className="mb-2 font-body text-[13px] text-error">{rollbackError}</p>}
          {rollbacks.length === 0 ? (
            <p className="font-body text-[12.5px] text-ink-muted">Больше нет изменений, доступных для отката.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {rollbacks.map((r) => (
                <li key={r.auditLogId} className="flex items-center justify-between gap-3 border-t border-dashed border-border pt-2 first:border-none first:pt-0">
                  <span className="font-body text-[13px] text-ink">
                    {new Date(r.createdAt).toLocaleString("ru-RU")} — изменено {r.affected}{" "}
                    {r.affected === 1 ? "товар" : "товаров"}
                  </span>
                  <Button
                    variant="ghost"
                    loading={rollbackPending === r.auditLogId}
                    onClick={() => handleRollback(r.auditLogId)}
                  >
                    Откатить
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Select label="Поле" value={field} onChange={(e) => setField(e.target.value as BulkField)}>
          <option value="price">Цены</option>
          <option value="stock">Остатки</option>
        </Select>
        <Select label="Правило" value={op} onChange={(e) => setOp(e.target.value as BulkOp)}>
          <option value="percent">+/- %</option>
          <option value="delta">+/- число</option>
          <option value="fixed">Установить значение</option>
        </Select>
        <TextField label="Значение" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
        <Select label="Категория" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Весь каталог</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentId ? `— ${c.name}` : c.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-4">
        <Button loading={pending} onClick={handlePreview}>
          Показать предпросмотр
        </Button>
      </div>

      {preview && (
        <div className="mt-4">
          {preview.length === 0 ? (
            <p className="font-body text-[13px] text-ink-muted">Нет товаров, подходящих под условие.</p>
          ) : (
            <>
              <table className="w-full font-body text-[12.5px]">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th className="p-2">Товар</th>
                    <th className="p-2">Было</th>
                    <th className="p-2">Стало</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((r) => (
                    <tr key={r.plantId} className="border-t border-dashed border-border">
                      <td className="p-2">{r.name}</td>
                      <td className="p-2 font-mono">{r.before}</td>
                      <td className="p-2 font-mono text-sap">{r.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 font-body text-[12px] text-ink-muted">
                Показаны первые 10 из {preview.length}. Применится ко всем {preview.length}.
              </p>
              {error && <p className="mt-2 font-body text-[12.5px] text-error">{error}</p>}
              <div className="mt-3">
                <Button variant="destructive" loading={pending} onClick={handleApply}>
                  Применить к {preview.length} товарам
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

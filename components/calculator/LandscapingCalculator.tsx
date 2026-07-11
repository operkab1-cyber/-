"use client";

// Rule 9 — перенос landscaping_calculator.html (питомник «Дебский») в
// React-компонент клиентского острова. Логика (шаги, формула сметы, отправка
// заявки в WhatsApp) сохранена как есть; каталог растений подключён к реальным
// данным из БД вместо захардкоженного JSON (см. lib/queries/calculator.ts).
// Ставки на газон/декор/работы и номер WhatsApp по-прежнему редактируются только
// в рамках сессии браузера (как и в оригинале — "для постоянного сохранения
// нужно подключить к серверу/БД", это не переделано, чтобы не выйти за rule 9).

import { useMemo, useState } from "react";
import type { CalculatorCategory } from "@/lib/queries/calculator";

interface CartLine {
  id: string;
  name: string;
  price: number;
  qty: number;
  categorySlug: string;
}

interface Rates {
  lawnReady: number;
  lawnPrep: number;
  autopoliv: number;
  stones: number;
  bark: number;
  work: number | null;
  phone: string;
}

const DEFAULT_RATES: Rates = {
  lawnReady: 700,
  lawnPrep: 1500,
  autopoliv: 2100,
  stones: 700,
  bark: 800,
  work: null,
  phone: "996700000000",
};

export function LandscapingCalculator({ catalog }: { catalog: CalculatorCategory[] }) {
  const [activeTab, setActiveTab] = useState(catalog[0]?.slug ?? "");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [siteArea, setSiteArea] = useState(0);
  const [lawnVal, setLawnVal] = useState<"none" | "ready" | "prep">("none");
  const [autopoliv, setAutopoliv] = useState(false);
  const [stonesArea, setStonesArea] = useState(0);
  const [barkArea, setBarkArea] = useState(0);
  const [worksChecked, setWorksChecked] = useState(false);
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");

  const activeCategory = catalog.find((c) => c.slug === activeTab);
  const visibleItems = (activeCategory?.items ?? []).filter((it) => it.name.toLowerCase().includes(search.toLowerCase()));

  function addToCart(item: { id: string; name: string; price: number }, categorySlug: string) {
    setCart((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: existing
          ? { ...existing, qty: existing.qty + 1 }
          : { id: item.id, name: item.name, price: item.price, qty: 1, categorySlug },
      };
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      }
      return { ...prev, [id]: { ...existing, qty: nextQty } };
    });
  }

  function removeFromCart(id: string) {
    setCart((prev) => {
      const rest = { ...prev };
      delete rest[id];
      return rest;
    });
  }

  const totals = useMemo(() => {
    const plantsTotal = Object.values(cart).reduce((s, it) => s + it.price * it.qty, 0);

    let lawnTotal = 0;
    if (lawnVal === "ready") lawnTotal += siteArea * rates.lawnReady;
    if (lawnVal === "prep") lawnTotal += siteArea * rates.lawnPrep;
    if (autopoliv) lawnTotal += siteArea * rates.autopoliv;

    const decorTotal = stonesArea * rates.stones + barkArea * rates.bark;

    let worksTotal = 0;
    let worksUnquoted = false;
    if (worksChecked) {
      if (rates.work && rates.work > 0) worksTotal = siteArea * rates.work;
      else worksUnquoted = true;
    }

    return {
      plantsTotal,
      lawnTotal,
      decorTotal,
      worksTotal,
      worksUnquoted,
      total: plantsTotal + lawnTotal + decorTotal + worksTotal,
    };
  }, [cart, siteArea, lawnVal, autopoliv, stonesArea, barkArea, worksChecked, rates]);

  function submitRequest() {
    if (!custName.trim() || !custPhone.trim()) {
      alert("Пожалуйста, укажите имя и телефон.");
      return;
    }

    let msg = `Заявка с калькулятора озеленения — Tamga Green\n`;
    msg += `Имя: ${custName}\nТелефон: ${custPhone}\n`;
    msg += `Площадь участка: ${siteArea} м²\n\n`;

    const items = Object.values(cart);
    if (items.length) {
      msg += `Растения:\n`;
      items.forEach((it) => {
        msg += `— ${it.name} × ${it.qty} = ${(it.price * it.qty).toLocaleString("ru-RU")} сом\n`;
      });
      msg += `\n`;
    }

    msg += `Смета:\n`;
    msg += `Растения: ${totals.plantsTotal.toLocaleString("ru-RU")} сом\n`;
    msg += `Газон: ${totals.lawnTotal.toLocaleString("ru-RU")} сом${autopoliv ? " (с автополивом)" : ""}\n`;
    msg += `Декор (камни ${stonesArea}м² + кора ${barkArea}м²): ${totals.decorTotal.toLocaleString("ru-RU")} сом\n`;
    msg += `Работы: ${totals.worksUnquoted ? "ТРЕБУЕТСЯ УТОЧНЕНИЕ У МЕНЕДЖЕРА" : totals.worksTotal.toLocaleString("ru-RU") + " сом"}\n\n`;
    msg += `ИТОГО: ${totals.total.toLocaleString("ru-RU")} сом${totals.worksUnquoted ? " + стоимость работ (уточняется)" : ""}\n\n`;
    msg += `Расчёт ориентировочный, точную стоимость подтверждает менеджер после осмотра участка.`;

    const url = `https://wa.me/${rates.phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  const cartCount = Object.values(cart).reduce((s, it) => s + it.qty, 0);

  return (
    <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-5 px-4 py-5 lg:grid-cols-[1fr_380px]">
      <div>
        {/* Шаг 1 — площадь участка */}
        <div className="mb-4 rounded-lg border border-border bg-white p-4 shadow-sm">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-stamp">Шаг 1</p>
          <h2 className="mb-2 font-display text-[17px] font-semibold text-canopy">Площадь участка</h2>
          <label className="mb-1 block font-body text-[13px] font-semibold text-ink">Общая площадь, м²</label>
          <input
            type="number"
            min={0}
            value={siteArea}
            onChange={(e) => setSiteArea(Math.max(0, Number(e.target.value) || 0))}
            className="w-full rounded-sm border border-border bg-paper px-3 py-2 font-body text-[14px]"
          />
          <p className="mt-1 font-body text-[12.5px] text-ink-muted">
            Используется для расчёта газона и комплексных работ. Декор считается отдельно (шаг 4).
          </p>
        </div>

        {/* Шаг 2 — растения */}
        <div className="mb-4 rounded-lg border border-border bg-white p-4 shadow-sm">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-stamp">Шаг 2</p>
          <h2 className="mb-2 font-display text-[17px] font-semibold text-canopy">Растения</h2>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {catalog.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setActiveTab(c.slug)}
                className={
                  "rounded-full px-3 py-1.5 font-mono text-[12px] " +
                  (activeTab === c.slug ? "bg-sap text-white" : "border border-border bg-paper text-ink-muted")
                }
              >
                {c.label} ({c.items.length})
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию…"
            className="mb-2.5 w-full rounded-sm border border-border bg-paper px-3 py-2 font-body text-[14px]"
          />
          <div className="max-h-[420px] overflow-y-auto rounded-md border border-border">
            {visibleItems.length === 0 ? (
              <div className="p-3.5 text-center font-body text-[13px] text-ink-muted">Ничего не найдено</div>
            ) : (
              visibleItems.map((it) => (
                <div key={it.id} className="flex items-center justify-between gap-2.5 border-b border-border px-3 py-2 last:border-none">
                  <div className="flex-1 font-body text-[13.5px]">
                    {it.name}
                    {it.oos && (
                      <span className="ml-1.5 rounded-full bg-error-bg px-1.5 py-0.5 font-mono text-[10px] text-error">
                        нет в наличии
                      </span>
                    )}
                  </div>
                  <div className="whitespace-nowrap font-mono text-[13px] text-ink-muted">
                    {it.price.toLocaleString("ru-RU")} сом
                  </div>
                  <button
                    type="button"
                    title="Добавить"
                    onClick={() => addToCart(it, activeTab)}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-sap text-[16px] text-white hover:bg-sap-hover"
                  >
                    +
                  </button>
                </div>
              ))
            )}
          </div>

          <h3 className="mb-2 mt-4 font-body text-[14px]">Смета — растения ({cartCount})</h3>
          <div>
            {Object.keys(cart).length === 0 ? (
              <div className="p-3.5 text-center font-body text-[13px] text-ink-muted">Пока ничего не выбрано</div>
            ) : (
              Object.values(cart).map((it) => (
                <div key={it.id} className="flex items-center gap-2 border-b border-border py-2 font-body text-[13px] last:border-none">
                  <div className="flex-1">
                    {it.name}
                    <br />
                    <span className="font-mono text-[11px] text-ink-muted">
                      {it.price.toLocaleString("ru-RU")} сом × {it.qty}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => changeQty(it.id, -1)} className="h-[22px] w-[22px] rounded border border-border bg-paper font-body text-[13px]">
                      −
                    </button>
                    <span className="min-w-[20px] text-center font-mono">{it.qty}</span>
                    <button type="button" onClick={() => changeQty(it.id, 1)} className="h-[22px] w-[22px] rounded border border-border bg-paper font-body text-[13px]">
                      +
                    </button>
                  </div>
                  <button type="button" onClick={() => removeFromCart(it.id)} className="font-body text-[14px] text-error">
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Шаг 3 — газон */}
        <div className="mb-4 rounded-lg border border-border bg-white p-4 shadow-sm">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-stamp">Шаг 3</p>
          <h2 className="mb-2 font-display text-[17px] font-semibold text-canopy">Газон</h2>
          <div className="flex flex-col gap-2">
            {(
              [
                ["none", "Газон не нужен", null],
                ["ready", "Земля готова", rates.lawnReady],
                ["prep", "Требуется подготовка земли", rates.lawnPrep],
              ] as const
            ).map(([value, label, rate]) => (
              <label
                key={value}
                className={
                  "flex cursor-pointer items-center gap-2 rounded-sm border px-2.5 py-2 font-body text-[13.5px] " +
                  (lawnVal === value ? "border-sap bg-sprout-bg" : "border-border")
                }
              >
                <input type="radio" name="lawn" checked={lawnVal === value} onChange={() => setLawnVal(value)} />
                {label}
                {rate != null && <span> — {rate.toLocaleString("ru-RU")} сом/м²</span>}
              </label>
            ))}
          </div>
          <label className="mt-2.5 flex cursor-pointer items-start gap-2 font-body text-[13.5px]">
            <input type="checkbox" checked={autopoliv} onChange={(e) => setAutopoliv(e.target.checked)} className="mt-0.5" />
            Автополив (+{rates.autopoliv.toLocaleString("ru-RU")} сом/м²)
          </label>
          <p className="mt-1 font-body text-[12.5px] text-ink-muted">
            Автополив — без учёта насоса и блока управления, стоимость уточняется отдельно.
          </p>
        </div>

        {/* Шаг 4 — декор */}
        <div className="mb-4 rounded-lg border border-border bg-white p-4 shadow-sm">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-stamp">Шаг 4</p>
          <h2 className="mb-2 font-display text-[17px] font-semibold text-canopy">Декор</h2>
          <div className="flex flex-wrap gap-3.5">
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block font-body text-[13px] font-semibold text-ink">Камни, м²</label>
              <input
                type="number"
                min={0}
                value={stonesArea}
                onChange={(e) => setStonesArea(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-sm border border-border bg-paper px-3 py-2 font-body text-[14px]"
              />
              <p className="mt-1 font-body text-[12.5px] text-ink-muted">{rates.stones.toLocaleString("ru-RU")} сом/м²</p>
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block font-body text-[13px] font-semibold text-ink">Кора, м²</label>
              <input
                type="number"
                min={0}
                value={barkArea}
                onChange={(e) => setBarkArea(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-sm border border-border bg-paper px-3 py-2 font-body text-[14px]"
              />
              <p className="mt-1 font-body text-[12.5px] text-ink-muted">{rates.bark.toLocaleString("ru-RU")} сом/м²</p>
            </div>
          </div>
        </div>

        {/* Шаг 5 — посадка и ландшафтный дизайн */}
        <div className="mb-4 rounded-lg border border-border bg-white p-4 shadow-sm">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-stamp">Шаг 5</p>
          <h2 className="mb-2 font-display text-[17px] font-semibold text-canopy">Посадка и ландшафтный дизайн</h2>
          <label className="flex cursor-pointer items-start gap-2 font-body text-[13.5px]">
            <input type="checkbox" checked={worksChecked} onChange={(e) => setWorksChecked(e.target.checked)} className="mt-0.5" />
            Нужны комплексные работы по посадке и озеленению участка
          </label>
          <p className="mt-1 font-body text-[12.5px] text-ink-muted">
            {rates.work && rates.work > 0
              ? `Ставка: ${rates.work.toLocaleString("ru-RU")} сом/м²`
              : "Точная ставка за м² пока не определена — стоимость уточнит менеджер."}
          </p>
        </div>
      </div>

      {/* Смета — колонка справа */}
      <div className="sticky top-4 h-max rounded-lg border border-border bg-white p-4 shadow-sm">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-stamp">Смета</p>
        <h2 className="mb-2 font-display text-[17px] font-semibold text-canopy">Итог</h2>

        <div className="text-[13.5px]">
          <div className="flex justify-between border-b border-dashed border-border py-1.5">
            <span>Растения</span>
            <span className="font-mono">{totals.plantsTotal.toLocaleString("ru-RU")} сом</span>
          </div>
          <div className="flex justify-between border-b border-dashed border-border py-1.5">
            <span>Газон</span>
            <span className="font-mono">{totals.lawnTotal.toLocaleString("ru-RU")} сом</span>
          </div>
          <div className="flex justify-between border-b border-dashed border-border py-1.5">
            <span>Декор</span>
            <span className="font-mono">{totals.decorTotal.toLocaleString("ru-RU")} сом</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span>Работы</span>
            <span className="font-mono">{totals.worksUnquoted ? "уточняется" : `${totals.worksTotal.toLocaleString("ru-RU")} сом`}</span>
          </div>
        </div>

        <div className="my-1.5 font-display text-[30px] text-canopy">{totals.total.toLocaleString("ru-RU")} сом</div>

        {totals.worksUnquoted && (
          <div className="mt-2 rounded-sm bg-stamp-bg px-2.5 py-2 font-body text-[12px] text-stamp-dark">
            Стоимость комплексных работ уточняет менеджер — ставка пока не задана. Эта позиция отмечена в
            заявке отдельно и не включена в итог.
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block font-body text-[13px] font-semibold text-ink">Имя</label>
          <input
            type="text"
            value={custName}
            onChange={(e) => setCustName(e.target.value)}
            placeholder="Как к вам обращаться"
            className="w-full rounded-sm border border-border bg-paper px-3 py-2 font-body text-[14px]"
          />
        </div>
        <div className="mt-2.5">
          <label className="mb-1 block font-body text-[13px] font-semibold text-ink">Телефон</label>
          <input
            type="tel"
            value={custPhone}
            onChange={(e) => setCustPhone(e.target.value)}
            placeholder="+996 ..."
            className="w-full rounded-sm border border-border bg-paper px-3 py-2 font-body text-[14px]"
          />
        </div>
        <div className="mt-3.5">
          <button
            type="button"
            onClick={submitRequest}
            className="w-full rounded-md bg-sap px-4 py-2.5 font-body text-sm font-semibold text-white hover:bg-sap-hover"
          >
            Отправить заявку в WhatsApp
          </button>
        </div>

        <p className="mt-2.5 font-body text-[11.5px] leading-relaxed text-ink-muted">
          Расчёт ориентировочный. Точную стоимость подтверждает менеджер после осмотра участка.
        </p>

        <details className="mt-5 rounded-md border border-dashed border-stamp bg-stamp-bg p-3">
          <summary className="cursor-pointer font-mono text-[12px] uppercase tracking-wide text-stamp-dark">
            Настройки цен (для менеджера)
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <RateField label="Газон, готовая земля (сом/м²)" value={rates.lawnReady} onChange={(v) => setRates((r) => ({ ...r, lawnReady: v }))} />
            <RateField label="Газон, требует подготовки (сом/м²)" value={rates.lawnPrep} onChange={(v) => setRates((r) => ({ ...r, lawnPrep: v }))} />
            <RateField label="Автополив, доплата (сом/м²)" value={rates.autopoliv} onChange={(v) => setRates((r) => ({ ...r, autopoliv: v }))} />
            <RateField label="Камни (сом/м²)" value={rates.stones} onChange={(v) => setRates((r) => ({ ...r, stones: v }))} />
            <RateField label="Кора (сом/м²)" value={rates.bark} onChange={(v) => setRates((r) => ({ ...r, bark: v }))} />
            <div>
              <label className="mb-0.5 block font-body text-[11.5px]">Комплексные работы (сом/м²)</label>
              <input
                type="number"
                placeholder="не задано"
                value={rates.work ?? ""}
                onChange={(e) => setRates((r) => ({ ...r, work: e.target.value ? Number(e.target.value) : null }))}
                className="w-full rounded-sm border border-border bg-paper px-2 py-1.5 font-body text-[13px]"
              />
            </div>
            <div>
              <label className="mb-0.5 block font-body text-[11.5px]">WhatsApp менеджера (номер)</label>
              <input
                type="text"
                value={rates.phone}
                onChange={(e) => setRates((r) => ({ ...r, phone: e.target.value.replace(/[^\d]/g, "") }))}
                className="w-full rounded-sm border border-border bg-paper px-2 py-1.5 font-body text-[13px]"
              />
            </div>
          </div>
          <p className="mt-2 font-body text-[11.5px] text-stamp-dark">
            Изменения действуют в рамках текущей сессии в браузере. Для постоянного сохранения ставок нужно
            подключить это поле к серверу/базе данных сайта.
          </p>
        </details>
      </div>
    </div>
  );
}

function RateField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="mb-0.5 block font-body text-[11.5px]">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-sm border border-border bg-paper px-2 py-1.5 font-body text-[13px]"
      />
    </div>
  );
}

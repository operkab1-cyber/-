"use client";

import { useState } from "react";
import { createRequest } from "@/lib/actions/requests";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";

type CargoType = "regular" | "live_plants";

// UX Bible §9.1 — калькулятор доставки. Вход по спецификации: адрес
// получателя, вес/объём, тип груза (обычная посылка vs. живые растения с
// температурным режимом). Выход по спецификации — "список опций доставки с
// ценой и сроком, интеграция с модулем логистики поставщика" — такого модуля
// нет ни в одном из 9 документов (Database Design не содержит таблиц
// перевозчиков/тарифов/зон, Architecture §6.5 упоминает Edge Function
// calculate-shipping, но не источник тарифов). Выдумывать цифры или схему
// перевозчика значило бы нарушить rule 1/2 — вместо этого форма собирает
// структурированный вход и отправляет заявку на расчёт через уже
// существующий тип requests.type='quote' (Plant Catalog §11), менеджер
// считает и отвечает вручную. То же решение, что у "работ" без заданной
// ставки в landscaping-калькуляторе (Phase 8) — честно "уточняется", а не
// придуманное число.
export function ShippingQuoteCalculator() {
  const [address, setAddress] = useState("");
  const [weight, setWeight] = useState(0);
  const [volume, setVolume] = useState(0);
  const [cargoType, setCargoType] = useState<CargoType>("regular");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!address.trim() || !name.trim() || !email.trim()) {
      setError("Заполните адрес, имя и email.");
      return;
    }
    setPending(true);
    setError(null);

    const message =
      `Запрос расчёта доставки\n` +
      `Адрес получателя: ${address}\n` +
      `Вес: ${weight} кг, объём: ${volume} м³\n` +
      `Тип груза: ${cargoType === "live_plants" ? "живые растения (нужен температурный режим)" : "обычная посылка"}`;

    const formData = new FormData();
    formData.set("type", "quote");
    formData.set("name", name);
    formData.set("email", email);
    if (phone) formData.set("phone", phone);
    formData.set("message", message);

    const result = await createRequest(formData);
    setPending(false);
    if (result.error) setError(result.error);
    else setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg border border-sap bg-sprout-bg p-6 text-center">
        <p className="font-body text-[14px] text-canopy">
          Заявка на расчёт доставки отправлена. Менеджер пришлёт точную стоимость и срок.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="mb-4 font-body text-[13px] text-ink-muted">
        Точная стоимость и сроки зависят от перевозчика и маршрута — заполните форму, и менеджер
        пришлёт расчёт.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Адрес получателя" value={address} onChange={(e) => setAddress(e.target.value)} />
        <Select label="Тип груза" value={cargoType} onChange={(e) => setCargoType(e.target.value as CargoType)}>
          <option value="regular">Обычная посылка</option>
          <option value="live_plants">Живые растения (температурный режим)</option>
        </Select>
        <TextField label="Вес, кг" type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value) || 0)} />
        <TextField label="Объём, м³" type="number" value={volume} onChange={(e) => setVolume(Number(e.target.value) || 0)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField label="Имя" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Телефон" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>

      {error && <p className="mt-3 font-body text-[12.5px] text-error">{error}</p>}

      <div className="mt-4">
        <Button loading={pending} onClick={handleSubmit}>
          Отправить запрос на расчёт
        </Button>
      </div>
    </div>
  );
}

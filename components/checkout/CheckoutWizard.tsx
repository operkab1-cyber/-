"use client";

import { useState } from "react";
import { submitOrder, type ShippingAddress, type ShippingMethod, type PaymentMethod } from "@/lib/actions/orders";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/auth/Stepper";
import type { CartSummary } from "@/lib/queries/cart";

// UX Bible §8.2 — чекаут: 1. адрес → 2. доставка → 3. оплата → 4. подтверждение.
export function CheckoutWizard({ locale, cart }: { locale: string; cart: CartSummary }) {
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState<ShippingAddress>({
    recipientName: "",
    phone: "",
    country: "",
    city: "",
    street: "",
    postalCode: "",
  });
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("carrier");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("invoice");
  const [agree, setAgree] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addressValid = Object.values(address).every((v) => v.trim().length > 0);

  async function handleSubmit() {
    setPending(true);
    setError(null);
    const result = await submitOrder(locale, address, shippingMethod, paymentMethod);
    setPending(false);
    if (result?.error) setError(result.error);
    // submitOrder редиректит на успехе — сюда доходим только при ошибке.
  }

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-border bg-white p-6 shadow-sm">
      <Stepper step={step} total={4} />

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold text-canopy">Адрес и получатель</h2>
          <TextField
            label="Получатель"
            name="recipientName"
            value={address.recipientName}
            onChange={(e) => setAddress({ ...address, recipientName: e.target.value })}
          />
          <TextField
            label="Телефон"
            name="phone"
            value={address.phone}
            onChange={(e) => setAddress({ ...address, phone: e.target.value })}
          />
          <TextField
            label="Страна"
            name="country"
            value={address.country}
            onChange={(e) => setAddress({ ...address, country: e.target.value })}
          />
          <TextField
            label="Город"
            name="city"
            value={address.city}
            onChange={(e) => setAddress({ ...address, city: e.target.value })}
          />
          <TextField
            label="Улица, дом"
            name="street"
            value={address.street}
            onChange={(e) => setAddress({ ...address, street: e.target.value })}
          />
          <TextField
            label="Почтовый индекс"
            name="postalCode"
            value={address.postalCode}
            onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
          />
          <div className="mt-2 flex justify-end">
            <Button type="button" disabled={!addressValid} onClick={() => setStep(2)}>
              Далее
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-canopy">Способ доставки</h2>
          {(
            [
              { value: "carrier", label: "Доставка перевозчиком-партнёром", hint: "1500 KGS, бесплатно от 50 000 KGS" },
              { value: "pickup", label: "Самовывоз с хаба", hint: "Бесплатно" },
              { value: "own_transport", label: "Собственный транспорт покупателя", hint: "Бесплатно" },
            ] as { value: ShippingMethod; label: string; hint: string }[]
          ).map((opt) => (
            <label
              key={opt.value}
              className={
                "flex cursor-pointer items-center justify-between rounded-md border px-3 py-2.5 font-body text-[13.5px] " +
                (shippingMethod === opt.value ? "border-sap bg-sprout-bg" : "border-border")
              }
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="shipping"
                  checked={shippingMethod === opt.value}
                  onChange={() => setShippingMethod(opt.value)}
                />
                {opt.label}
              </span>
              <span className="font-mono text-[11.5px] text-ink-muted">{opt.hint}</span>
            </label>
          ))}
          <div className="mt-2 flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Назад
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Далее
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-canopy">Способ оплаты</h2>
          {(
            [
              { value: "invoice", label: "Инвойс с отсрочкой платежа" },
              { value: "card", label: "Карта / SEPA" },
              { value: "escrow", label: "Эскроу (для новых контрагентов)" },
            ] as { value: PaymentMethod; label: string }[]
          ).map((opt) => (
            <label
              key={opt.value}
              className={
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 font-body text-[13.5px] " +
                (paymentMethod === opt.value ? "border-sap bg-sprout-bg" : "border-border")
              }
            >
              <input
                type="radio"
                name="payment"
                checked={paymentMethod === opt.value}
                onChange={() => setPaymentMethod(opt.value)}
              />
              {opt.label}
            </label>
          ))}
          <p className="font-body text-[12px] text-ink-muted">
            Реальная обработка платежа не подключена в MVP — заказ создаётся, оплата согласуется с
            менеджером отдельно.
          </p>
          <div className="mt-2 flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              Назад
            </Button>
            <Button type="button" onClick={() => setStep(4)}>
              Далее
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-semibold text-canopy">Подтверждение</h2>
          {cart.groups.map((group) => (
            <div key={group.companyId} className="rounded-md border border-border p-3">
              <p className="font-body text-[13.5px] font-semibold text-ink">{group.companyName}</p>
              <p className="font-mono text-[12.5px] text-ink-muted">
                {group.items.length} позиций — {group.subtotal.toLocaleString("ru-RU")} {group.currency}
              </p>
            </div>
          ))}
          <label className="mt-2 flex items-start gap-2 font-body text-[13px] text-ink">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
            Согласен с условиями поставки
          </label>
          {error && <p className="font-body text-[12.5px] text-error">{error}</p>}
          <div className="mt-2 flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(3)} disabled={pending}>
              Назад
            </Button>
            <Button type="button" disabled={!agree} loading={pending} onClick={handleSubmit}>
              Подтвердить заказ
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

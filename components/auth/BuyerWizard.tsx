"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { buyerRegistrationSchema, BUYER_BUSINESS_TYPES, type BuyerRegistrationInput } from "@/lib/validation/auth";
import { registerCompany } from "@/lib/actions/auth";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Stepper } from "./Stepper";
import { REGISTRATION_COUNTRIES } from "@/lib/countries";

const BUSINESS_TYPE_LABELS: Record<(typeof BUYER_BUSINESS_TYPES)[number], string> = {
  garden_center: "Садовый центр",
  landscaper: "Ландшафтная компания",
  other: "Другое",
};

const STEP_FIELDS: Record<number, (keyof BuyerRegistrationInput)[]> = {
  1: ["contactName", "companyName", "country", "address", "vatNumber", "email", "phone", "password", "agreeTerms"],
  2: ["businessType", "monthlyPurchaseVolume", "deliveryRegion"],
};

// Покупатель — доп. шаг: тип бизнеса, объём закупок, регион доставки (UX Bible §4.2).
export function BuyerWizard({ locale, onBack }: { locale: string; onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<BuyerRegistrationInput>({
    resolver: zodResolver(buyerRegistrationSchema),
    defaultValues: { role: "buyer" },
  });

  async function goNext() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => s + 1);
  }

  async function onSubmit(data: BuyerRegistrationInput) {
    setServerError(null);
    setPending(true);
    const formData = new FormData();
    formData.set("role", "buyer");
    formData.set("contactName", data.contactName);
    formData.set("companyName", data.companyName);
    formData.set("country", data.country);
    formData.set("address", data.address);
    formData.set("vatNumber", data.vatNumber);
    formData.set("email", data.email);
    formData.set("phone", data.phone);
    formData.set("password", data.password);
    formData.set("agreeTerms", "true");
    formData.set("businessType", data.businessType);
    formData.set("monthlyPurchaseVolume", data.monthlyPurchaseVolume);
    formData.set("deliveryRegion", data.deliveryRegion);

    const result = await registerCompany(locale, formData);
    setPending(false);
    if (result?.error) setServerError(result.error);
    if (result?.fieldErrors) {
      const first = Object.values(result.fieldErrors)[0]?.[0];
      if (first) setServerError(first);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-border bg-white p-6 shadow-sm">
      <Stepper step={step} total={3} />

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <TextField label="Имя контактного лица" {...register("contactName")} error={errors.contactName?.message} />
          <TextField label="Название компании" {...register("companyName")} error={errors.companyName?.message} />
          <Select label="Страна" {...register("country")} error={errors.country?.message} defaultValue="">
            <option value="" disabled>
              Выберите страну
            </option>
            {REGISTRATION_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
          <TextField label="Юридический адрес" {...register("address")} error={errors.address?.message} />
          <TextField label="VAT / налоговый номер" {...register("vatNumber")} error={errors.vatNumber?.message} />
          <TextField label="Email" type="email" {...register("email")} error={errors.email?.message} />
          <TextField label="Телефон" type="tel" {...register("phone")} error={errors.phone?.message} />
          <TextField label="Пароль" type="password" {...register("password")} error={errors.password?.message} />
          <label className="flex items-start gap-2 font-body text-[13px] text-ink">
            <input type="checkbox" {...register("agreeTerms")} className="mt-0.5" />
            Согласен с условиями использования платформы
          </label>
          {errors.agreeTerms && <p className="font-body text-[12.5px] text-error">{errors.agreeTerms.message}</p>}

          <div className="mt-2 flex justify-between">
            <Button type="button" variant="ghost" onClick={onBack}>
              Назад
            </Button>
            <Button type="button" onClick={goNext}>
              Далее
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <Select label="Тип бизнеса" {...register("businessType")} error={errors.businessType?.message} defaultValue="">
            <option value="" disabled>
              Выберите тип
            </option>
            {BUYER_BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {BUSINESS_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <TextField
            label="Примерный объём закупок в месяц"
            placeholder="например, 5000-10000 €"
            {...register("monthlyPurchaseVolume")}
            error={errors.monthlyPurchaseVolume?.message}
          />
          <TextField
            label="Регион доставки"
            {...register("deliveryRegion")}
            error={errors.deliveryRegion?.message}
          />

          <div className="mt-2 flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Назад
            </Button>
            <Button type="button" onClick={goNext}>
              Далее
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <p className="font-body text-[14px] text-ink-muted">
            Проверьте данные и отправьте заявку на проверку — обычно занимает 24–48 часов
            (UX Bible §4.3).
          </p>
          {serverError && (
            <div className="rounded-sm border border-error bg-error-bg px-3 py-2 font-body text-[13px] text-error">
              {serverError}
            </div>
          )}
          <div className="mt-2 flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(2)} disabled={pending}>
              Назад
            </Button>
            <Button type="submit" loading={pending}>
              Отправить на проверку
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

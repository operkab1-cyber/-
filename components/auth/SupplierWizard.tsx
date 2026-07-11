"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supplierRegistrationSchema, type SupplierRegistrationInput } from "@/lib/validation/auth";
import { registerCompany } from "@/lib/actions/auth";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Stepper } from "./Stepper";
import { REGISTRATION_COUNTRIES, CATALOG_CATEGORY_OPTIONS } from "@/lib/countries";

const STEP_FIELDS: Record<number, (keyof SupplierRegistrationInput)[]> = {
  1: ["contactName", "companyName", "country", "address", "vatNumber", "email", "phone", "password", "agreeTerms"],
  2: ["productCategories"],
};

// Поставщик — доп. шаг с категориями товаров и фитосертификатом (UX Bible §4.2,
// "Поля (только Поставщик, доп. шаг)").
export function SupplierWizard({ locale, onBack }: { locale: string; onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<SupplierRegistrationInput>({
    resolver: zodResolver(supplierRegistrationSchema),
    defaultValues: { role: "supplier", productCategories: [], hasOrganicCert: false },
  });

  async function goNext() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => s + 1);
  }

  async function onSubmit(data: SupplierRegistrationInput) {
    setServerError(null);
    setPending(true);
    const formData = new FormData();
    formData.set("role", "supplier");
    formData.set("contactName", data.contactName);
    formData.set("companyName", data.companyName);
    formData.set("country", data.country);
    formData.set("address", data.address);
    formData.set("vatNumber", data.vatNumber);
    formData.set("email", data.email);
    formData.set("phone", data.phone);
    formData.set("password", data.password);
    formData.set("agreeTerms", "true");
    data.productCategories.forEach((c) => formData.append("productCategories", c));
    formData.set("hasOrganicCert", String(data.hasOrganicCert ?? false));
    if (certFile) formData.set("phytosanitaryCert", certFile);

    const result = await registerCompany(locale, formData);
    setPending(false);
    if (result?.error) setServerError(result.error);
    // fieldErrors по шагу 1 маловероятны здесь (уже провалидировано на клиенте
    // той же схемой), но на всякий случай показываем как общую ошибку.
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
          <div>
            <p className="mb-2 font-body text-[13px] font-semibold text-ink">Категории товаров</p>
            <div className="flex flex-col gap-2">
              {CATALOG_CATEGORY_OPTIONS.map((c) => (
                <label key={c.slug} className="flex items-center gap-2 font-body text-[13.5px] text-ink">
                  <input type="checkbox" value={c.slug} {...register("productCategories")} />
                  {c.label}
                </label>
              ))}
            </div>
            {errors.productCategories && (
              <p className="mt-1 font-body text-[12.5px] text-error">{errors.productCategories.message}</p>
            )}
          </div>

          <div>
            <p className="mb-2 font-body text-[13px] font-semibold text-ink">Фитосанитарный сертификат</p>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              className="font-body text-[13.5px]"
            />
            <p className="mt-1 font-body text-[12.5px] text-ink-muted">PDF/JPG/PNG, до 10 МБ (необязательно на этом шаге).</p>
          </div>

          <label className="flex items-center gap-2 font-body text-[13.5px] text-ink">
            <input type="checkbox" {...register("hasOrganicCert")} />
            Есть органик-сертификат
          </label>

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
            (UX Bible §4.3). Пока не подтверждено, каталог доступен только для просмотра.
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

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { plantFormSchema, type PlantFormInput } from "@/lib/validation/plant";
import { createPlant } from "@/lib/actions/supplierCatalog";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/auth/Stepper";
import type { CatalogCategory } from "@/lib/queries/catalog";

const STEP_FIELDS: Record<number, (keyof PlantFormInput)[]> = {
  1: ["name", "categoryId", "latinName"],
  3: ["price", "minQty", "stockQty"],
};

// Admin Panel §3.1 — степпер 4 шага: Основное → Фото → Характеристики → Цена и остаток.
// Шаг "Фото" — Phase 5 ограничен: загрузка не в этой форме (см. отчёт Phase 5),
// сразу после публикации фото можно добавить отдельно (backlog).
export function AddPlantWizard({ locale, categories }: { locale: string; categories: CatalogCategory[] }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const {
    register,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<PlantFormInput>({
    resolver: zodResolver(plantFormSchema),
    defaultValues: { minQty: 1, stockQty: 0 },
  });

  async function goNext(fields: (keyof PlantFormInput)[]) {
    const valid = await trigger(fields);
    if (valid) setStep((s) => s + 1);
  }

  async function submit(publish: boolean) {
    const valid = await trigger();
    if (!valid) return;
    setPending(true);
    setError(null);
    const values = getValues();
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.set(key, String(value));
    });
    const result = await createPlant(formData, publish, locale);
    setPending(false);
    if (result?.error) setError(result.error);
    if (result?.fieldErrors) {
      const first = Object.values(result.fieldErrors)[0]?.[0];
      if (first) setError(first);
    }
  }

  return (
    <div className="mx-auto max-w-lg rounded-lg border border-border bg-white p-6 shadow-sm">
      <Stepper step={step} total={4} />

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold text-canopy">Основное</h2>
          <TextField label="Название" {...register("name")} error={errors.name?.message} />
          <Select label="Категория" {...register("categoryId")} error={errors.categoryId?.message} defaultValue="">
            <option value="" disabled>
              Выберите категорию
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? `— ${c.name}` : c.name}
              </option>
            ))}
          </Select>
          <TextField label="Латинское название (необязательно)" {...register("latinName")} />
          <div className="flex justify-end">
            <Button type="button" onClick={() => goNext(STEP_FIELDS[1] ?? [])}>
              Далее
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold text-canopy">Фото</h2>
          <p className="font-body text-[13px] text-ink-muted">
            Загрузка фото при создании — backlog Phase 5 (см. TODO.md). Фото можно добавить сразу
            после публикации со страницы товара.
          </p>
          <div className="flex justify-between">
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
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold text-canopy">Характеристики</h2>
          <Select label="Зона морозостойкости" {...register("hardinessZone")} defaultValue="">
            <option value="">Не указано</option>
            {["zone_3", "zone_4", "zone_5", "zone_6", "zone_7", "zone_8", "zone_9"].map((z) => (
              <option key={z} value={z}>
                {z.replace("zone_", "Зона ")}
              </option>
            ))}
          </Select>
          <Select label="Освещение" {...register("light")} defaultValue="">
            <option value="">Не указано</option>
            <option value="sun">Солнце</option>
            <option value="partial_shade">Полутень</option>
            <option value="shade">Тень</option>
          </Select>
          <TextField label="Высота (например, 60-120 см)" {...register("heightRange")} />
          <TextField label="Объём контейнера (например, 5 л)" {...register("containerVolume")} />
          <Select label="Форма кроны" {...register("crownForm")} defaultValue="">
            <option value="">Не указано</option>
            <option value="bush">Кустовая</option>
            <option value="standard">Штамбовая</option>
          </Select>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              Назад
            </Button>
            <Button type="button" onClick={() => goNext(STEP_FIELDS[3] ?? [])}>
              Далее
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold text-canopy">Цена и остаток</h2>
          <TextField label="Цена, KGS (от 1 шт)" type="number" {...register("price")} error={errors.price?.message} />
          <TextField label="Минимальный объём заказа" type="number" {...register("minQty")} />
          <TextField label="Остаток" type="number" {...register("stockQty")} />
          {error && <p className="font-body text-[12.5px] text-error">{error}</p>}
          <div className="flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(3)} disabled={pending}>
              Назад
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" loading={pending} onClick={() => submit(false)}>
                Сохранить как черновик
              </Button>
              <Button type="button" loading={pending} onClick={() => submit(true)}>
                Опубликовать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { createRequest } from "@/lib/actions/requests";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

type RequestType = "quote" | "plant_availability_alert";

// Plant Catalog §11.2 (quote) / §7 карточки товара (plant_availability_alert):
// минимум обязательных полей, остальное подтягивается на сервере из subjectId.
export function RequestForm({
  type,
  plantId,
  title,
  submitLabel,
}: {
  type: RequestType;
  plantId: string;
  title: string;
  submitLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("type", type);
    formData.set("subjectType", "plant");
    formData.set("subjectId", plantId);
    const result = await createRequest(formData);
    setPending(false);
    if (result.error) setError(result.error);
    else setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-sm border border-sap bg-sprout-bg px-3 py-2 font-body text-[13px] text-canopy">
        Заявка отправлена — с вами свяжутся в ближайшее время.
      </div>
    );
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        {title}
      </Button>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-3 rounded-md border border-border bg-white p-4">
      <p className="font-body text-[13.5px] font-semibold text-ink">{title}</p>
      <TextField label="Имя" name="name" required />
      <TextField label="Email" name="email" type="email" required />
      <TextField label="Телефон" name="phone" type="tel" />
      {type === "quote" && (
        <TextField label="Желаемое количество и комментарий" name="message" placeholder="например, 500 шт к сентябрю" />
      )}
      {error && <p className="font-body text-[12.5px] text-error">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

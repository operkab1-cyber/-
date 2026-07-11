"use client";

import { useState } from "react";
import { approveCompany, rejectCompany } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";
import type { PendingCompany } from "@/lib/queries/admin";

export function VerificationQueueRow({ company, locale }: { company: PendingCompany; locale: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setPending(true);
    const result = await approveCompany(company.id, locale);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  async function handleReject() {
    if (!reason.trim()) {
      setError("Укажите причину отказа");
      return;
    }
    setPending(true);
    const result = await rejectCompany(company.id, reason, locale);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 last:border-none">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-body text-[14px] font-semibold text-ink">{company.name}</p>
          <p className="font-mono text-[12px] text-ink-muted">
            {company.type} · {company.country}
          </p>
        </div>
        {!rejecting ? (
          <div className="flex gap-2">
            <Button variant="primary" loading={pending} onClick={handleApprove}>
              Подтвердить
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => setRejecting(true)}>
              Отклонить
            </Button>
          </div>
        ) : null}
      </div>
      {rejecting && (
        <div className="flex items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина отказа (уйдёт пользователю)"
            className="flex-1 rounded-sm border border-border px-3 py-2 font-body text-[13px]"
          />
          <Button variant="destructive" loading={pending} onClick={handleReject}>
            Отклонить
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setRejecting(false)}>
            Отмена
          </Button>
        </div>
      )}
      {error && <p className="font-body text-[12.5px] text-error">{error}</p>}
    </div>
  );
}

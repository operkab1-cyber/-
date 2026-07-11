"use client";

import { useState } from "react";
import { advanceOrderStatus, cancelOrder } from "@/lib/actions/orderStatus";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_TONE, NEXT_STATUS } from "@/lib/orderStatusLabels";
import type { OrderSummary } from "@/lib/queries/orders";

// UX Bible §5.3 — карточка заказа поставщика: покупатель, состав, сумма,
// дедлайн подтверждения, «Подтвердить»/«Отклонить» (с причиной)/следующий статус.
export function SupplierOrderCard({ order, locale }: { order: OrderSummary; locale: string }) {
  const [pending, setPending] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nextStatus = NEXT_STATUS[order.status];
  const isTerminal = order.status === "completed" || order.status === "cancelled" || order.status === "disputed";

  async function handleAdvance() {
    if (!nextStatus) return;
    setPending(true);
    const result = await advanceOrderStatus(order.id, nextStatus, locale);
    setPending(false);
    if (result.error) setError(result.error);
  }

  async function handleReject() {
    if (!reason.trim()) {
      setError("Укажите причину отклонения");
      return;
    }
    setPending(true);
    const result = await cancelOrder(order.id, reason, locale);
    setPending(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] text-ink">{order.orderNumber}</span>
        <Badge tone={ORDER_STATUS_BADGE_TONE[order.status] ?? "muted"}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
      </div>
      <p className="mt-1 font-body text-[13.5px] text-ink-muted">
        {order.counterpartyName} · {order.itemCount} позиций · {order.total.toLocaleString("ru-RU")} {order.currency}
      </p>
      {order.status === "new" && order.confirmDeadline && (
        <p className="mt-1 font-mono text-[11.5px] text-stamp-dark">
          Подтвердить до {new Date(order.confirmDeadline).toLocaleString("ru-RU")}
        </p>
      )}

      {!isTerminal && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {nextStatus && (
            <Button loading={pending} onClick={handleAdvance}>
              {order.status === "new" ? "Подтвердить" : `→ ${ORDER_STATUS_LABELS[nextStatus]}`}
            </Button>
          )}
          {order.status === "new" && !rejecting && (
            <Button variant="destructive" disabled={pending} onClick={() => setRejecting(true)}>
              Отклонить
            </Button>
          )}
        </div>
      )}

      {rejecting && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина отклонения"
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

      {error && <p className="mt-2 font-body text-[12.5px] text-error">{error}</p>}
    </div>
  );
}

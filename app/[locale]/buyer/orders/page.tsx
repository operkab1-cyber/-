import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/queries/account";
import { getBuyerOrders } from "@/lib/queries/orders";
import { Badge } from "@/components/ui/Badge";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE_TONE } from "@/lib/orderStatusLabels";

// UX Bible §6.2 — заказы и история покупателя.
export default async function BuyerOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const { locale } = await params;
  const { success } = await searchParams;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "buyer") redirect(`/${locale}/onboarding/status`);

  const orders = await getBuyerOrders();
  const successNumbers = success?.split(",").filter(Boolean) ?? [];

  return (
    <main className="mx-auto max-w-[900px] px-5 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold text-canopy">Заказы</h1>

      {successNumbers.length > 0 && (
        <div className="mb-6 rounded-lg border border-sap bg-sprout-bg p-4">
          <p className="font-body text-[13.5px] font-semibold text-canopy">Заказ оформлен</p>
          <p className="mt-1 font-mono text-[13px] text-ink">
            {successNumbers.length > 1 ? "Номера заказов: " : "Номер заказа: "}
            {successNumbers.join(", ")}
          </p>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
          Вы ещё не сделали ни одного заказа.
          <div className="mt-3">
            <Link href={`/${locale}/catalog`} className="underline">
              Перейти в каталог
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-lg border border-border bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[13px] text-ink">{order.orderNumber}</span>
                <Badge tone={ORDER_STATUS_BADGE_TONE[order.status] ?? "muted"}>
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </Badge>
              </div>
              <p className="mt-1 font-body text-[13.5px] text-ink-muted">
                {order.counterpartyName} · {order.itemCount} позиций
              </p>
              <p className="mt-1 font-mono text-[13px] text-ink">
                {order.total.toLocaleString("ru-RU")} {order.currency}
              </p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

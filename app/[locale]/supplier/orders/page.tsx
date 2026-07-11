import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { getSupplierOrders } from "@/lib/queries/orders";
import { SupplierOrderCard } from "@/components/orders/SupplierOrderCard";

// UX Bible §5.3 — заказы поставщика.
export default async function SupplierOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "supplier") redirect(`/${locale}/onboarding/status`);

  const orders = await getSupplierOrders();

  return (
    <main className="mx-auto max-w-[900px] px-5 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold text-canopy">Заказы</h1>
      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
          Новых заказов нет.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <SupplierOrderCard key={order.id} order={order} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}

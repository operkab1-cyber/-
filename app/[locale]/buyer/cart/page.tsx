import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/queries/account";
import { getCartSummary } from "@/lib/queries/cart";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { Button } from "@/components/ui/Button";

// UX Bible §8.1 — корзина заявок: группы по поставщику, индикатор минимального
// объёма, итоговая сумма, "Оформить заказ".
export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "buyer") redirect(`/${locale}/onboarding/status`);

  const cart = await getCartSummary(locale);

  return (
    <main className="mx-auto max-w-[900px] px-5 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold text-canopy">Корзина заявок</h1>

      {cart.groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
          Корзина пуста.
          <div className="mt-3">
            <Link href={`/${locale}/catalog`} className="underline">
              Перейти в каталог
            </Link>
          </div>
        </div>
      ) : (
        <>
          {cart.groups.map((group) => (
            <div key={group.companyId} className="mb-5 rounded-lg border border-border bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-body text-[14px] font-semibold text-ink">{group.companyName}</p>
                <span className="font-mono text-[13px] text-ink">
                  {group.subtotal.toLocaleString("ru-RU")} {group.currency}
                </span>
              </div>
              {group.items.map((item) => (
                <CartItemRow key={item.itemId} item={item} locale={locale} />
              ))}
              {!group.meetsMinimum && (
                <div className="mt-2 rounded-sm bg-stamp-bg px-3 py-2 font-body text-[12.5px] text-stamp-dark">
                  Добавьте ещё товаров этого поставщика — минимальный объём заказа {group.minOrderQty} шт.
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between rounded-lg border border-border bg-white p-4">
            <span className="font-body text-[14px] font-semibold text-ink">Итого</span>
            <span className="font-mono text-[16px] text-canopy">{cart.total.toLocaleString("ru-RU")}</span>
          </div>

          {cart.groups.length > 1 && (
            <p className="mt-2 font-body text-[12.5px] text-ink-muted">
              Заказ будет разбит на {cart.groups.length} отправки от разных поставщиков.
            </p>
          )}

          <div className="mt-4 flex justify-end">
            {cart.groups.some((g) => !g.meetsMinimum) ? (
              <Button disabled title="Не достигнут минимальный объём заказа">
                Оформить заказ
              </Button>
            ) : (
              <Link
                href={`/${locale}/buyer/checkout`}
                className="inline-flex items-center gap-2 rounded-md bg-sap px-5 py-3 font-body text-sm font-semibold text-white hover:bg-sap-hover"
              >
                Оформить заказ
              </Link>
            )}
          </div>
        </>
      )}
    </main>
  );
}

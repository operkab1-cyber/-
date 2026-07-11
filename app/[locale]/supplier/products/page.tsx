import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/queries/account";
import { getSupplierPlants, getSupplierDashboardCounts } from "@/lib/queries/supplierCatalog";
import { InlinePriceCell } from "@/components/supplier/InlinePriceCell";
import { InlineStockCell } from "@/components/supplier/InlineStockCell";
import { Badge } from "@/components/ui/Badge";
import { DuplicateButton } from "@/components/supplier/DuplicateButton";

// Admin Panel §2 — дашборд каталога: сводка + быстрые действия + таблица.
export default async function SupplierProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "supplier") redirect(`/${locale}/onboarding/status`);
  if (account.company?.verificationStatus !== "approved") redirect(`/${locale}/onboarding/status`);

  const [plants, counts] = await Promise.all([getSupplierPlants(locale), getSupplierDashboardCounts()]);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <h1 className="mb-2 font-display text-2xl font-semibold text-canopy">Каталог</h1>
      <p className="mb-5 font-body text-[13.5px] text-ink-muted">
        {counts.total} товаров · {counts.outOfStock} нет в наличии · {counts.needsAiAttention} требуют внимания AI ⚠
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href={`/${locale}/supplier/products/new`} className="rounded-md bg-sap px-4 py-2 font-body text-sm font-semibold text-white hover:bg-sap-hover">
          + Добавить растение
        </Link>
        <Link href={`/${locale}/supplier/products/import`} className="rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink hover:bg-paper-deep">
          ⇧ Импорт из Excel
        </Link>
        <Link href={`/${locale}/supplier/products/bulk`} className="rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink hover:bg-paper-deep">
          Массовое изменение цен/остатков
        </Link>
        <Link href={`/${locale}/supplier/analytics`} className="rounded-md border border-border bg-white px-4 py-2 font-body text-sm text-ink hover:bg-paper-deep">
          Аналитика
        </Link>
      </div>

      {plants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
          Добавьте первый товар, чтобы покупатели вас нашли.
          <div className="mt-3">
            <Link href={`/${locale}/supplier/products/new`} className="underline">
              Добавить товар
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full font-body text-[13.5px]">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="p-3">Название</th>
                <th className="p-3">Категория</th>
                <th className="p-3">Остаток</th>
                <th className="p-3">Цена</th>
                <th className="p-3">Статус</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {plants.map((p) => (
                <tr key={p.id} className="border-b border-dashed border-border last:border-none">
                  <td className="p-3">
                    <span className="font-semibold text-ink">{p.name}</span>
                    {p.needsAiAttention && <span className="ml-1 text-stamp" title="Требует внимания AI">⚠</span>}
                  </td>
                  <td className="p-3 text-ink-muted">{p.categoryName ?? "—"}</td>
                  <td className="p-3">
                    <InlineStockCell plantId={p.id} stock={p.stock} locale={locale} />
                  </td>
                  <td className="p-3">
                    <InlinePriceCell plantId={p.id} price={p.priceFrom} currency={p.currency} locale={locale} />
                  </td>
                  <td className="p-3">
                    <Badge tone={p.status === "active" ? "sprout" : p.status === "out_of_stock" ? "error" : "muted"}>
                      {p.status === "active" ? "активен" : p.status === "draft" ? "черновик" : p.status === "out_of_stock" ? "закончился" : p.status}
                    </Badge>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <Link href={`/${locale}/supplier/products/${p.id}/photos`} className="mr-2 font-body text-[12px] text-ink-muted underline">
                      Фото
                    </Link>
                    <DuplicateButton plantId={p.id} locale={locale} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

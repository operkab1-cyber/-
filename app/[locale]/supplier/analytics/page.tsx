import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { getSalesByPeriod, getTopPlantsByDemand } from "@/lib/queries/analytics";

// Admin Panel §8.1 — минимум: "продажи за период" + "топ по спросу".
export default async function SupplierAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "supplier") redirect(`/${locale}/onboarding/status`);
  if (account.company?.verificationStatus !== "approved") redirect(`/${locale}/onboarding/status`);

  const [sales, topPlants] = await Promise.all([getSalesByPeriod(), getTopPlantsByDemand(locale)]);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold text-canopy">Аналитика</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-5">
          <p className="mb-3 font-body text-[13px] font-semibold text-ink">Продажи за период (по неделям)</p>
          {sales.length === 0 ? (
            <p className="font-body text-[13px] text-ink-muted">
              Аналитика появится после первых 5 заказов. (0 из 5)
            </p>
          ) : (
            <table className="w-full font-body text-[13px]">
              <tbody>
                {sales.map((s) => (
                  <tr key={s.period} className="border-b border-dashed border-border last:border-none">
                    <td className="py-1.5 font-mono text-ink-muted">{s.period}</td>
                    <td className="py-1.5 text-right font-mono text-ink">{s.total.toLocaleString("ru-RU")} KGS</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-lg border border-border bg-white p-5">
          <p className="mb-3 font-body text-[13px] font-semibold text-ink">Топ-5 товаров по спросу</p>
          {topPlants.length === 0 ? (
            <p className="font-body text-[13px] text-ink-muted">Пока нет данных о заказах.</p>
          ) : (
            <ol className="flex flex-col gap-1.5 font-body text-[13px]">
              {topPlants.map((p, i) => (
                <li key={p.plantId} className="flex justify-between">
                  <span>
                    {i + 1}. {p.name}
                  </span>
                  <span className="font-mono text-ink-muted">{p.qtySold} шт</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <p className="mt-6 font-body text-[12.5px] text-ink-muted">
        Тепловая карта регионов, сравнение цены со средней по рынку, товары без просмотров — backlog (Admin
        Panel §8.2, требует больше данных/поставщиков, чем есть в MVP-каталоге одного питомника).
      </p>
    </main>
  );
}

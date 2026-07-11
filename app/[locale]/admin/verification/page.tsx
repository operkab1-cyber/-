import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { getPendingCompanies } from "@/lib/queries/admin";
import { VerificationQueueRow } from "@/components/admin/VerificationQueueRow";

// UX Bible §12.1 — очередь верификации. Просмотр PDF/изображений документов
// прямо в интерфейсе — оставлено на Phase 5/9 (не блокирует Phase 2 DoD: тест
// двух аккаунтов и RLS не требует полноценного файлового вьюера).
export default async function AdminVerificationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "admin") redirect(`/${locale}/onboarding/status`);

  const pending = await getPendingCompanies();

  return (
    <main className="mx-auto max-w-[800px] px-5 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold text-canopy">Очередь верификации</h1>
      {pending.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-10 text-center text-ink-muted">
          Новых заявок нет.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white p-4">
          {pending.map((company) => (
            <VerificationQueueRow key={company.id} company={company} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}

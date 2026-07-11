import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { getCategoryTree } from "@/lib/queries/catalog";
import { getRecentPriceRollbacks } from "@/lib/actions/bulkUpdate";
import { BulkUpdateWizard } from "@/components/supplier/BulkUpdateWizard";

export default async function BulkUpdatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "supplier") redirect(`/${locale}/onboarding/status`);
  if (account.company?.verificationStatus !== "approved") redirect(`/${locale}/onboarding/status`);

  const [categories, recentRollbacks] = await Promise.all([getCategoryTree(locale), getRecentPriceRollbacks()]);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold text-canopy">Массовое изменение цен/остатков</h1>
      <BulkUpdateWizard locale={locale} categories={categories} recentRollbacks={recentRollbacks} />
    </main>
  );
}

import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { getCategoryTree } from "@/lib/queries/catalog";
import { ImportWizard } from "@/components/supplier/ImportWizard";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "supplier") redirect(`/${locale}/onboarding/status`);
  if (account.company?.verificationStatus !== "approved") redirect(`/${locale}/onboarding/status`);

  const categories = await getCategoryTree(locale);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold text-canopy">Импорт из Excel/CSV</h1>
      <ImportWizard locale={locale} categories={categories} />
    </main>
  );
}

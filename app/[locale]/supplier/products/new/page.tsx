import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { getCategoryTree } from "@/lib/queries/catalog";
import { AddPlantWizard } from "@/components/supplier/AddPlantWizard";

export default async function NewPlantPage({
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
      <h1 className="mb-6 text-center font-display text-2xl font-semibold text-canopy">Добавить растение</h1>
      <AddPlantWizard locale={locale} categories={categories} />
    </main>
  );
}

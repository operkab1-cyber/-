import { CompareTable } from "@/components/catalog/CompareTable";

export default async function ComparePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold text-canopy">Сравнение растений</h1>
      <CompareTable locale={locale} />
    </main>
  );
}

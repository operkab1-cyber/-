import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { getCartSummary } from "@/lib/queries/cart";
import { CheckoutWizard } from "@/components/checkout/CheckoutWizard";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (account.role !== "buyer") redirect(`/${locale}/onboarding/status`);

  const cart = await getCartSummary(locale);
  if (cart.groups.length === 0) redirect(`/${locale}/buyer/cart`);

  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <h1 className="mb-6 text-center font-display text-2xl font-semibold text-canopy">Оформление заказа</h1>
      <CheckoutWizard locale={locale} cart={cart} />
    </main>
  );
}

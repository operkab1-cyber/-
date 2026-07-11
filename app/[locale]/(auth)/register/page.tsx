import { RegisterFlow } from "@/components/auth/RegisterFlow";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Регистрация",
};

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-12">
      <h1 className="mb-8 text-center font-display text-3xl font-semibold text-canopy">
        Регистрация на Tamga Green
      </h1>
      <RegisterFlow locale={locale} />
    </main>
  );
}

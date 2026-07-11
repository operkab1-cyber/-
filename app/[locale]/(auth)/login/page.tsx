import { LoginForm } from "@/components/auth/LoginForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход",
};

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-12">
      <h1 className="mb-8 text-center font-display text-3xl font-semibold text-canopy">Вход</h1>
      <LoginForm locale={locale} />
    </main>
  );
}

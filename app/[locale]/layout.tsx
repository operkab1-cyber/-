import type { Metadata } from "next";
import { Fraunces, Inter, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "../globals.css";

// [решено самостоятельно] Google Fonts не поставляет кириллицу для Fraunces (только
// latin/latin-ext/vietnamese) — заголовки на ru будут рендериться системным serif-фолбэком
// вместо Fraunces, это ограничение самого шрифта, а не конфигурации. Зафиксировано в TODO.md.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", weight: ["600", "700"] });
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], variable: "--font-plex-mono", weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "Tamga Green", template: "%s | Tamga Green" },
  description: "Маркетплейс для садовых центров и питомников Европы.",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <body className="font-body">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

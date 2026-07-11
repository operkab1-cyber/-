import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/queries/account";
import { Badge } from "@/components/ui/Badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Статус верификации",
};

const STEPS = ["Загружено", "На проверке", "Подтверждено"] as const;

// UX Bible §4.3: статус-трекер после отправки документов. Пока не подтверждено —
// доступен только просмотр каталога (read-only), заказ/загрузка товаров закрыты
// (это обеспечивает RLS: verification_status='approved' в публичных read-политиках
// и company_id-владение в write-политиках — тут только отображение статуса).
export default async function VerificationStatusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const account = await getCurrentAccount();
  if (!account) redirect(`/${locale}/login`);
  if (!account.company) redirect(`/${locale}/register`);

  const status = account.company.verificationStatus;
  const currentStepIndex = status === "approved" ? 2 : status === "rejected" ? 1 : 1;

  return (
    <main className="mx-auto max-w-lg px-5 py-12">
      <h1 className="mb-2 font-display text-2xl font-semibold text-canopy">
        {account.company.name}
      </h1>
      <p className="mb-6 font-body text-[14px] text-ink-muted">
        Роль: {account.role === "supplier" ? "Поставщик" : "Покупатель"}
      </p>

      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={
                "flex h-7 w-7 items-center justify-center rounded-full font-mono text-[11px] " +
                (status === "rejected" && i === 1
                  ? "bg-error text-white"
                  : i <= currentStepIndex
                    ? "bg-sap text-white"
                    : "bg-paper-deep text-ink-muted")
              }
            >
              {i + 1}
            </div>
            <span className="font-body text-[12.5px] text-ink-muted">{label}</span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
          </div>
        ))}
      </div>

      {status === "pending" && (
        <div className="rounded-lg border border-stamp bg-stamp-bg p-4">
          <Badge tone="stamp">На проверке</Badge>
          <p className="mt-2 font-body text-[13.5px] text-ink">
            Обычно проверка занимает 24–48 часов. Пока заявка рассматривается, вы можете
            просматривать каталог в режиме чтения — оформление заказов и загрузка товаров
            станут доступны после подтверждения.
          </p>
        </div>
      )}

      {status === "approved" && (
        <div className="rounded-lg border border-sap bg-sprout-bg p-4">
          <Badge tone="sprout">Подтверждено</Badge>
          <p className="mt-2 font-body text-[13.5px] text-ink">
            Аккаунт подтверждён.{" "}
            <a
              href={`/${locale}/${account.role === "supplier" ? "supplier" : "buyer"}/dashboard`}
              className="underline"
            >
              Перейти в кабинет
            </a>
          </p>
        </div>
      )}

      {status === "rejected" && (
        <div className="rounded-lg border border-error bg-error-bg p-4">
          <Badge tone="error">Отклонено</Badge>
          <p className="mt-2 font-body text-[13.5px] text-ink">
            {account.verificationDocuments.find((d) => d.status === "rejected")?.rejectionReason ??
              "Заявка отклонена. Свяжитесь с поддержкой или загрузите документы повторно."}
          </p>
          <p className="mt-2 font-body text-[13px] text-ink-muted">
            Загрузка документов повторно и чат с поддержкой — на стороне CMS (Phase 5).
          </p>
        </div>
      )}
    </main>
  );
}

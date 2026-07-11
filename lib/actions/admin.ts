"use server";

// Минимальное администраторское действие — подтверждение/отклонение верификации
// (UX Bible §12.1: "кнопки «Подтвердить»/«Отклонить», причина уходит пользователю").
// Полноценная очередь верификации с документами/PDF-просмотром — не назначена ни
// одной фазе Build Prompt явно (Tamga_Green_Admin_Panel.md — это CMS поставщика,
// а не кабинет платформенного администратора); эта версия — минимум, достаточный
// чтобы протестировать сквозной флоу онбординга из Phase 2.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveCompany(companyId: string, locale: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ verification_status: "approved" })
    .eq("id", companyId);
  if (error) return { error: error.message };
  revalidatePath(`/${locale}/admin/verification`);
  return {};
}

export async function rejectCompany(companyId: string, reason: string, locale: string) {
  const supabase = await createClient();
  const { error: companyError } = await supabase
    .from("companies")
    .update({ verification_status: "rejected" })
    .eq("id", companyId);
  if (companyError) return { error: companyError.message };

  // Причина отказа хранится на документах компании, чтобы дойти до статус-экрана
  // покупателя/поставщика (UX Bible §4.3 — "конкретная причина отказа").
  const { error: docsError } = await supabase
    .from("verification_documents")
    .update({ status: "rejected", rejection_reason: reason })
    .eq("company_id", companyId);
  if (docsError) return { error: docsError.message };

  revalidatePath(`/${locale}/admin/verification`);
  return {};
}

"use server";

// Заявки (Plant Catalog §11) — более лёгкая сущность, чем заказ: "Сообщить о
// поступлении" (нет в наличии) и "Запросить цену" (объём вне стандартных ступеней).
// Гость может оставить заявку без аккаунта (user_id — null, требует name/email).

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const requestSchema = z.object({
  type: z.enum(["quote", "contact", "project_consultation", "plant_availability_alert"]),
  subjectType: z.enum(["plant", "landscape_solution", "project"]).optional(),
  subjectId: z.string().uuid().optional(),
  name: z.string().min(1, "Введите имя"),
  email: z.string().email("Некорректный email"),
  phone: z.string().optional(),
  message: z.string().optional(),
});

export interface RequestActionResult {
  error?: string;
  success?: boolean;
}

export async function createRequest(formData: FormData): Promise<RequestActionResult> {
  const parsed = requestSchema.safeParse({
    type: formData.get("type"),
    subjectType: formData.get("subjectType") || undefined,
    subjectId: formData.get("subjectId") || undefined,
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    message: formData.get("message") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userId: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("users").select("id").eq("id", user.id).single();
    userId = profile?.id ?? null;
  }

  const { error } = await supabase.from("requests").insert({
    user_id: userId,
    type: parsed.data.type,
    subject_type: parsed.data.subjectType ?? null,
    subject_id: parsed.data.subjectId ?? null,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    message: parsed.data.message ?? null,
  });
  if (error) return { error: error.message };
  return { success: true };
}

"use server";

// Server Actions для регистрации/логина (System Architecture §4, §8).
// Каждое действие валидирует Zod-схемой, переиспользуемой с клиентской формой,
// и полагается на RLS как последний рубеж (§8: "даже если серверная проверка роли
// будет обойдена, база данных не отдаст чужие данные").

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  supplierRegistrationSchema,
  buyerRegistrationSchema,
  loginSchema,
  ALLOWED_VERIFICATION_FILE_TYPES,
  MAX_VERIFICATION_FILE_BYTES,
} from "@/lib/validation/auth";
import { slugify, randomSlugSuffix } from "@/lib/slug";

export interface ActionResult {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue; // файлы обрабатываются отдельно
    if (key === "productCategories") {
      obj[key] = formData.getAll(key).filter((v) => typeof v === "string");
      continue;
    }
    if (key === "agreeTerms" || key === "hasOrganicCert") {
      obj[key] = value === "true" || value === "on";
      continue;
    }
    obj[key] = value;
  }
  return obj;
}

// Регистрация компании (Поставщик или Покупатель) — UX Bible §4.2.
// Один Server Action на обе роли: дискриминированная Zod-схема сама выбирает
// нужный набор полей по `role`.
export async function registerCompany(
  locale: string,
  formData: FormData
): Promise<ActionResult> {
  const role = formData.get("role");
  const raw = formDataToObject(formData);

  const schema = role === "supplier" ? supplierRegistrationSchema : buyerRegistrationSchema;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }
  const data = parsed.data;

  const supabase = await createClient();

  // 1. Аккаунт в Supabase Auth.
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  });

  if (signUpError) {
    // Дубликат email — UX Bible §4.2: "Возможно, у вас уже есть аккаунт — войти?"
    if (/already registered|already exists/i.test(signUpError.message)) {
      return { error: "Аккаунт с таким email уже существует. Войти?" };
    }
    return { error: signUpError.message };
  }
  const user = signUpData.user;
  if (!user) {
    return { error: "Не удалось создать аккаунт, попробуйте снова." };
  }

  // 2. Компания.
  const companyType =
    data.role === "supplier" ? "nursery" : (data.businessType as string) ?? "other";
  const baseSlug = slugify(data.companyName);
  let companySlug = baseSlug;
  let companyId: string | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .insert({
        name: data.companyName,
        slug: companySlug,
        type: companyType as "nursery" | "wholesaler" | "garden_center" | "landscaper" | "other",
        country: data.country.toUpperCase(),
        vat_number: data.vatNumber,
        address: data.address,
        verification_status: "pending",
        monthly_purchase_volume:
          data.role === "buyer" ? (data as { monthlyPurchaseVolume: string }).monthlyPurchaseVolume : null,
      })
      .select("id")
      .single();

    if (!companyError && company) {
      companyId = company.id;
      break;
    }
    // slug unique violation — добавляем случайный суффикс и пробуем снова.
    if (companyError && !/duplicate key|unique/i.test(companyError.message)) {
      return { error: companyError.message };
    }
    companySlug = `${baseSlug}-${randomSlugSuffix()}`;
  }

  if (!companyId) {
    return { error: "Не удалось создать компанию, попробуйте снова." };
  }

  // 3. Профиль пользователя (Database Design §4 — users, поверх auth.users).
  const { error: userError } = await supabase.from("users").insert({
    id: user.id,
    company_id: companyId,
    role: data.role,
    full_name: data.contactName,
    email: data.email,
    phone: data.phone,
    locale,
  });
  if (userError) {
    return { error: userError.message };
  }

  // 4. Документы верификации (только Поставщик, доп. шаг из UX Bible §4.2).
  // Файлы валидируются здесь (тип/размер), а не в Zod (FormData File не входит
  // в JSON-схему). Загружаются в Storage напрямую с сервера в рамках уже
  // аутентифицированной сессии — RLS (0006_storage.sql) пропустит запись, т.к.
  // auth_company_id() теперь резолвится через только что созданную строку users.
  if (data.role === "supplier") {
    const files = formData.getAll("phytosanitaryCert").filter((f): f is File => f instanceof File);
    for (const file of files) {
      if (file.size === 0) continue;
      if (file.size > MAX_VERIFICATION_FILE_BYTES) {
        return { error: `Файл ${file.name} превышает 10 МБ.` };
      }
      if (!ALLOWED_VERIFICATION_FILE_TYPES.includes(file.type)) {
        return { error: `Файл ${file.name} — недопустимый формат (нужен PDF/JPG/PNG).` };
      }
      const path = `${companyId}/${Date.now()}-${slugify(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("verification-docs")
        .upload(path, file, { contentType: file.type });
      if (uploadError) {
        return { error: `Не удалось загрузить ${file.name}: ${uploadError.message}` };
      }
      const { error: docError } = await supabase.from("verification_documents").insert({
        company_id: companyId,
        doc_type: "phytosanitary",
        file_path: path,
        status: "pending",
      });
      if (docError) {
        return { error: docError.message };
      }
    }
  }

  redirect(`/${locale}/onboarding/status`);
}

export async function login(locale: string, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: "Неверный email или пароль." };
  }

  redirect(`/${locale}/onboarding/status`);
}

export async function logout(locale: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/login`);
}

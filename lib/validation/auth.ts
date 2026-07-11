// Zod-схемы регистрации — переиспользуются клиентской формой (react-hook-form)
// и Server Action (Tamga_Green_System_Architecture.md §4: "одна схема — два места
// использования"). Основано на UX Bible §4.2.

import { z } from "zod";

export const COMPANY_TYPES = [
  "nursery",
  "wholesaler",
  "garden_center",
  "landscaper",
  "other",
] as const;

export const BUYER_BUSINESS_TYPES = ["garden_center", "landscaper", "other"] as const;

// Маска VAT/налогового номера по стране — покрывает основные страны запуска
// (Architecture §11) плюс KG (реальный поставщик в seed-данных использует
// кыргызский ИНН, 14 цифр — не входит в стандарт EU VAT, но проверка по стране
// должна работать и для него). Остальные страны — общий разумный паттерн
// (буквы/цифры, 4-20 символов), а не блокировка регистрации.
const VAT_PATTERNS: Record<string, RegExp> = {
  NL: /^NL\d{9}B\d{2}$/,
  DE: /^DE\d{9}$/,
  PL: /^PL\d{10}$/,
  BE: /^BE0\d{9}$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  GB: /^GB\d{9}$/,
  KG: /^\d{14}$/,
};
const DEFAULT_VAT_PATTERN = /^[A-Z0-9]{4,20}$/i;

export function validateVatForCountry(country: string, vat: string): boolean {
  const pattern = VAT_PATTERNS[country.toUpperCase()] ?? DEFAULT_VAT_PATTERN;
  return pattern.test(vat.trim());
}

// [решено самостоятельно] UX Bible §4.2 перечисляет поля формы регистрации, но не
// называет отдельное поле "имя контактного лица" — при этом users.full_name NOT NULL
// (Database Design §4). Добавлено как обязательное поле формы, логичный минимум для
// связи с компанией.
const baseCompanySchema = z.object({
  contactName: z.string().min(2, "Введите имя контактного лица"),
  companyName: z.string().min(2, "Введите название компании"),
  country: z.string().length(2, "Выберите страну"),
  address: z.string().min(3, "Введите юридический адрес"),
  vatNumber: z.string().min(4, "Введите VAT/налоговый номер"),
  email: z.string().email("Некорректный email"),
  phone: z.string().min(5, "Введите телефон"),
  password: z.string().min(8, "Минимум 8 символов"),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: "Нужно согласие с условиями" }),
  }),
});

export const supplierRegistrationSchema = baseCompanySchema
  .extend({
    role: z.literal("supplier"),
    productCategories: z.array(z.string()).min(1, "Укажите хотя бы одну категорию товаров"),
    hasOrganicCert: z.boolean().optional().default(false),
  })
  .refine((data) => validateVatForCountry(data.country, data.vatNumber), {
    message: "VAT-номер не соответствует формату страны",
    path: ["vatNumber"],
  });

export const buyerRegistrationSchema = baseCompanySchema
  .extend({
    role: z.literal("buyer"),
    businessType: z.enum(BUYER_BUSINESS_TYPES),
    monthlyPurchaseVolume: z.string().min(1, "Укажите примерный объём закупок"),
    deliveryRegion: z.string().min(1, "Укажите регион доставки"),
  })
  .refine((data) => validateVatForCountry(data.country, data.vatNumber), {
    message: "VAT-номер не соответствует формату страны",
    path: ["vatNumber"],
  });

// [решено самостоятельно] z.discriminatedUnion требует ZodObject-члены, а .refine()
// оборачивает схему в ZodEffects — объединённая registrationSchema технически не
// типизируется. Не понадобилась на практике: Server Action и обе формы-визарда
// выбирают конкретную схему (supplier/buyer) по роли до валидации, а не полиморфно.
export type SupplierRegistrationInput = z.infer<typeof supplierRegistrationSchema>;
export type BuyerRegistrationInput = z.infer<typeof buyerRegistrationSchema>;

export const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Файлы верификации не проходят через Zod (FormData File не JSON-сериализуем
// в discriminated union выше) — валидируются отдельно на границе (тип/размер).
export const MAX_VERIFICATION_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_VERIFICATION_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

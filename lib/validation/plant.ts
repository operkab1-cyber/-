import { z } from "zod";

// Admin Panel §3.1 — форма добавления растения, 4 шага (здесь одна схема,
// шаги валидируются частями на клиенте, как в SupplierWizard/BuyerWizard).
export const plantFormSchema = z.object({
  name: z.string().min(2, "Введите название"),
  categoryId: z.string().uuid("Выберите категорию"),
  latinName: z.string().optional(),
  hardinessZone: z.string().optional(),
  light: z.enum(["sun", "partial_shade", "shade", ""]).optional(),
  heightRange: z.string().optional(),
  foliageType: z.enum(["evergreen", "deciduous", "variegated", ""]).optional(),
  containerVolume: z.string().optional(),
  crownForm: z.enum(["bush", "standard", ""]).optional(),
  price: z.coerce.number().positive("Цена должна быть больше 0"),
  minQty: z.coerce.number().positive().default(1),
  stockQty: z.coerce.number().min(0).default(0),
});

export type PlantFormInput = z.infer<typeof plantFormSchema>;

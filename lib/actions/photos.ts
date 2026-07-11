"use server";

// Admin Panel §6 — привязка загруженного фото к товару. Эвристическая проверка
// качества/разрешения — lib/photoHeuristics.ts (чистая функция, вызывается прямо
// на клиенте, не Server Action).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function attachPlantImage(plantId: string, filePath: string, isCover: boolean, locale: string) {
  const supabase = await createClient();
  const { data: existingImages } = await supabase.from("plant_images").select("id").eq("plant_id", plantId);
  const position = existingImages?.length ?? 0;

  const { error } = await supabase.from("plant_images").insert({
    plant_id: plantId,
    file_path: filePath,
    is_cover: isCover || position === 0,
    position,
  });
  if (error) return { error: error.message };

  if (isCover || position === 0) {
    const { data: img } = await supabase.from("plant_images").select("id").eq("plant_id", plantId).eq("file_path", filePath).single();
    if (img) await supabase.from("plants").update({ cover_image_id: img.id }).eq("id", plantId);
  }

  revalidatePath(`/${locale}/supplier/products`);
  return {};
}

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { checkImageHeuristics } from "@/lib/photoHeuristics";
import { attachPlantImage } from "@/lib/actions/photos";

interface ExistingImage {
  filePath: string;
  isCover: boolean;
}

// Admin Panel §6.1 — drag-and-drop (здесь: выбор файла), до 8 фото, первое —
// обложка. Проверка сразу после загрузки — см. lib/actions/photos.ts про то, что
// это эвристика по разрешению/размеру файла, а не настоящая vision-модель.
export function PhotoUploader({ plantId, companyId, locale, images }: { plantId: string; companyId: string; locale: string; images: ExistingImage[] }) {
  const [uploading, setUploading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(images.length);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (count >= 8) {
      setError("Максимум 8 фото на товар");
      return;
    }
    setUploading(true);
    setError(null);
    setWarning(null);

    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = URL.createObjectURL(file);
    });
    const check = checkImageHeuristics(dims.width, dims.height, file.size);
    if (!check.ok) setWarning(check.warning);

    const supabase = createClient();
    const path = `${companyId}/${plantId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "-")}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const result = await attachPlantImage(plantId, path, count === 0, locale);
    setUploading(false);
    if (result.error) setError(result.error);
    else setCount((c) => c + 1);
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-white p-4">
      <p className="mb-2 font-body text-[13px] font-semibold text-ink">Фото ({count}/8)</p>
      <input type="file" accept="image/*" disabled={uploading || count >= 8} onChange={handleFile} />
      <p className="mt-2 font-body text-[12px] text-ink-muted">
        Минимум {400}×{400}px, растение целиком + крупный план листвы/цветка.
      </p>
      {warning && (
        <p className="mt-2 font-body text-[12.5px] text-stamp-dark">⚠ {warning} — фото всё равно загружено, можно заменить.</p>
      )}
      {error && <p className="mt-2 font-body text-[12.5px] text-error">{error}</p>}
    </div>
  );
}

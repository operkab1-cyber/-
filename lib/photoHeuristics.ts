// Admin Panel §6 — проверка фото. Реальная AI-проверка соответствия виду/сорту
// (AI Architecture §7 — vision-модель + сравнение с latin_name/category_id) не
// реализована: нет ANTHROPIC_API_KEY в этой сессии (тот же зазор, что у
// AI-описаний в Phase 3, см. TODO.md). Это честная клиентская эвристика по
// разрешению/размеру файла, не AI — вызывается прямо из компонента, без похода
// на сервер (чистая функция).

export interface PhotoCheckResult {
  ok: boolean;
  warning: string | null;
}

const MIN_DIMENSION = 400;

export function checkImageHeuristics(width: number, height: number, fileSizeBytes: number): PhotoCheckResult {
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return { ok: false, warning: `Низкое разрешение (${width}×${height}) — рекомендуем не менее ${MIN_DIMENSION}×${MIN_DIMENSION}` };
  }
  if (fileSizeBytes < 5 * 1024) {
    return { ok: false, warning: "Файл подозрительно маленького размера — проверьте, что это то самое фото" };
  }
  return { ok: true, warning: null };
}

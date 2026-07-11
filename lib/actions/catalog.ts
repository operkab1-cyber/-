"use server";

// Тонкие server-action обёртки над lib/queries/catalog.ts для вызова из клиентских
// компонентов (сравнение читает список id из localStorage — доступно только на
// клиенте, поэтому сами данные товаров приходится дотягивать таким вызовом,
// а не обычным server-component fetch).

import { getPlantDetailsByIds } from "@/lib/queries/catalog";

export async function fetchPlantsForCompare(ids: string[], locale: string) {
  return getPlantDetailsByIds(ids, locale);
}

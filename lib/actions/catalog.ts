"use server";

// Тонкие server-action обёртки над lib/queries/catalog.ts для вызова из клиентских
// компонентов (сравнение читает список id из localStorage — доступно только на
// клиенте, поэтому сами данные товаров приходится дотягивать таким вызовом,
// а не обычным server-component fetch).

import { getPlantDetailsByIds, searchPlants } from "@/lib/queries/catalog";

export async function fetchPlantsForCompare(ids: string[], locale: string) {
  return getPlantDetailsByIds(ids, locale);
}

// Калькуляторы (UX Bible §9) ищут растение, чтобы применить к нему рассчитанное
// количество — тот же повод вызывать серверный поиск из клиентского компонента.
export async function searchPlantsForCalculator(query: string, locale: string) {
  return searchPlants(query, locale);
}

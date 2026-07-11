"use client";

// Сравнение растений — Plant Catalog §6.1: "сессионный список сравнения, до 4
// позиций, одной категории". localStorage вместо настоящей сессии на сервере —
// клиентская функция сравнения не требует сервера, только UI-состояние.

export interface CompareItem {
  id: string;
  slug: string;
  name: string;
  categorySlug: string;
}

const STORAGE_KEY = "tamga_compare";
const MAX_ITEMS = 4;
const EVENT_NAME = "tamga:compare-change";

export function getCompareItems(): CompareItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompareItem[]) : [];
  } catch {
    return [];
  }
}

function persist(items: CompareItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT_NAME));
}

export function isInCompare(id: string): boolean {
  return getCompareItems().some((i) => i.id === id);
}

// Возвращает { ok, error } — сравнение ограничено одной категорией
// (Plant Catalog §6.1: "при попытке добавить товар другой категории интерфейс
// мягко предупреждает").
export function toggleCompare(item: CompareItem): { ok: boolean; error?: string } {
  const items = getCompareItems();
  const existingIndex = items.findIndex((i) => i.id === item.id);
  if (existingIndex >= 0) {
    items.splice(existingIndex, 1);
    persist(items);
    return { ok: true };
  }
  if (items.length >= MAX_ITEMS) {
    return { ok: false, error: `Можно сравнить не больше ${MAX_ITEMS} товаров` };
  }
  const first = items[0];
  if (first && first.categorySlug !== item.categorySlug) {
    return { ok: false, error: "Сравнение ограничено одной категорией — начните новое сравнение" };
  }
  items.push(item);
  persist(items);
  return { ok: true };
}

export function clearCompare() {
  persist([]);
}

export function subscribeCompare(callback: () => void): () => void {
  window.addEventListener(EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

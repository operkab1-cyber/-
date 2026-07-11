// UX Bible §5.3 — канбан-подобный список статусов заказа поставщика.
export const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  packed: "Собран",
  shipped: "Отгружен",
  delivered: "Доставлен",
  completed: "Завершён",
  disputed: "Спор",
  cancelled: "Отменён",
};

export const ORDER_STATUS_BADGE_TONE: Record<string, "sprout" | "stamp" | "error" | "muted"> = {
  new: "stamp",
  confirmed: "stamp",
  packed: "stamp",
  shipped: "stamp",
  delivered: "sprout",
  completed: "sprout",
  disputed: "error",
  cancelled: "error",
};

export const NEXT_STATUS: Record<string, string | null> = {
  new: "confirmed",
  confirmed: "packed",
  packed: "shipped",
  shipped: "delivered",
  delivered: "completed",
  completed: null,
  disputed: null,
  cancelled: null,
};

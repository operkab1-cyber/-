// UX Bible §7.1 — строка поиска. Автодополнение с мини-карточками после 2 символов
// (§Plant Catalog §5) — требует клиентского debounce-запроса, backlog для Phase 6
// (AI-поиск/embedding-канал добавляется тогда же). Здесь — базовая форма,
// работает без JS (обычный GET на /search) для SEO и надёжности.
export function SearchBar({ locale, defaultValue }: { locale: string; defaultValue?: string }) {
  return (
    <form action={`/${locale}/search`} method="get" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Поиск по названию (рус./лат.)…"
        className="w-full rounded-sm border border-border bg-white px-3 py-2 font-body text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-stamp"
      />
      <button
        type="submit"
        className="whitespace-nowrap rounded-md bg-sap px-4 py-2 font-body text-sm font-semibold text-white hover:bg-sap-hover"
      >
        Найти
      </button>
    </form>
  );
}

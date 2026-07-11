// SEO Strategy §7.2 — skeleton вместо resize: резервирует высоту сетки, чтобы
// переход между категориями не двигал контент (CLS).
export default function CategoryLoading() {
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <div className="mb-4 h-4 w-40 animate-pulse rounded bg-paper-deep" />
      <div className="mb-6 h-8 w-64 animate-pulse rounded bg-paper-deep" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <div className="h-64 animate-pulse rounded-lg bg-paper-deep" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg bg-paper-deep" />
          ))}
        </div>
      </div>
    </main>
  );
}

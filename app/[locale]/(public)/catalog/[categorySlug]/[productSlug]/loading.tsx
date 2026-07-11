export default function ProductLoading() {
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8">
      <div className="mb-4 h-4 w-56 animate-pulse rounded bg-paper-deep" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-lg bg-paper-deep" />
        <div className="space-y-3">
          <div className="h-8 w-3/4 animate-pulse rounded bg-paper-deep" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-paper-deep" />
          <div className="h-40 animate-pulse rounded-lg bg-paper-deep" />
        </div>
      </div>
    </main>
  );
}

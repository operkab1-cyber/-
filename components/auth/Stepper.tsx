// Прогресс-индикатор шага формы — UX Bible §4.2 ("прогресс-индикатор 1/3, 2/3, 3/3").
export function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          className={
            "h-1.5 flex-1 rounded-full " + (n <= step ? "bg-sap" : "bg-paper-deep")
          }
        />
      ))}
      <span className="ml-2 whitespace-nowrap font-mono text-xs text-ink-muted">
        {step}/{total}
      </span>
    </div>
  );
}

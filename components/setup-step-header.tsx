const STEP_LABELS = ["Spil", "Spillere", "Format", "Start"] as const;

export function SetupStepHeader({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-1">
        {STEP_LABELS.map((label, index) => {
          const n = index + 1;
          const active = n === step;
          const done = n < step;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold tabular-nums ${
                  active
                    ? "border-dart-cream bg-dart-green text-dart-cream"
                    : done
                      ? "border-dart-green bg-dart-green/30 text-dart-cream"
                      : "border-dart-wire text-dart-muted"
                }`}
              >
                {n}
              </span>
              <span
                className={`text-[10px] uppercase tracking-wide ${
                  active ? "text-dart-cream" : "text-dart-muted"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-0.5 overflow-hidden rounded-full bg-dart-wire/40">
        <div
          className="h-full bg-dart-green transition-all duration-300"
          style={{ width: `${((step - 1) / (STEP_LABELS.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

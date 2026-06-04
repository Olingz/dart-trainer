import { BOARD_NUMBERS } from "@/lib/dart-score";

type MultiplierMode = 1 | 2 | 3;

const segmentButtonClass =
  "font-display min-h-12 rounded-xl border-2 border-dart-wire bg-dart-cream text-dart-black transition-colors active:scale-[0.97] active:bg-dart-cream/80 disabled:opacity-50";

function SegmentLabel({
  n,
  multiplierMode,
}: {
  n: number;
  multiplierMode: MultiplierMode;
}) {
  if (multiplierMode === 2) {
    return (
      <>
        <span className="text-dart-red">D</span>
        {n}
      </>
    );
  }
  if (multiplierMode === 3) {
    return (
      <>
        <span className="text-dart-green">T</span>
        {n}
      </>
    );
  }
  return <>{n}</>;
}

export function DartInputPad({
  title,
  hint,
  multiplierMode,
  onToggleMultiplier,
  onSegment,
  onBull,
  onMiss,
  disabled,
  error,
}: {
  title: string;
  hint: string;
  multiplierMode: MultiplierMode;
  onToggleMultiplier: (mode: 2 | 3) => void;
  onSegment: (segment: number) => void;
  onBull: () => void;
  onMiss: () => void;
  disabled?: boolean;
  error?: string | null;
}) {
  return (
    <div className="dart-panel rounded-2xl p-4">
      <p className="mb-3 text-sm font-medium text-dart-muted">
        {title} · {hint}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggleMultiplier(2)}
          className={`font-display min-h-14 rounded-xl border-2 text-2xl transition-colors ${
            multiplierMode === 2
              ? "border-dart-cream bg-dart-red text-dart-cream"
              : "border-dart-wire bg-dart-black text-dart-cream active:bg-dart-wire/40"
          }`}
        >
          Double
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggleMultiplier(3)}
          className={`font-display min-h-14 rounded-xl border-2 text-2xl transition-colors ${
            multiplierMode === 3
              ? "border-dart-cream bg-dart-green text-dart-cream"
              : "border-dart-wire bg-dart-black text-dart-cream active:bg-dart-wire/40"
          }`}
        >
          Triple
        </button>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {BOARD_NUMBERS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onSegment(n)}
            className={`${segmentButtonClass} text-2xl`}
          >
            <SegmentLabel n={n} multiplierMode={multiplierMode} />
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onBull}
          className="font-display min-h-12 rounded-xl border-2 border-dart-red bg-dart-red/25 text-xl text-dart-cream active:bg-dart-red/40"
        >
          {multiplierMode === 2 ? "Bull 50" : "Bull 25"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onMiss}
          className="font-display min-h-12 rounded-xl border-2 border-dart-wire bg-dart-black text-xl text-dart-muted active:bg-dart-wire/40"
        >
          Miss
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-dart-red">{error}</p>}
    </div>
  );
}

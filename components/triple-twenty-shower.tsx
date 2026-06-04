"use client";

const STAR_COUNT = 28;

export function TripleTwentyShower({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden
    >
      <p className="font-display t20-flash absolute left-1/2 top-[28%] -translate-x-1/2 text-6xl text-dart-cream drop-shadow-[0_0_12px_rgba(243,230,207,0.8)]">
        T20!
      </p>
      {Array.from({ length: STAR_COUNT }, (_, i) => (
        <span
          key={i}
          className="t20-star absolute"
          style={{
            left: `${5 + ((i * 37) % 90)}%`,
            top: `${-5 + ((i * 13) % 25)}%`,
            animationDelay: `${(i % 10) * 0.04}s`,
            fontSize: `${0.85 + (i % 4) * 0.35}rem`,
            color: i % 3 === 0 ? "#f3e6cf" : i % 3 === 1 ? "#cf2f2a" : "#ffd54a",
          }}
        >
          {i % 2 === 0 ? "✦" : "★"}
        </span>
      ))}
    </div>
  );
}

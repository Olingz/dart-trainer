import { isDeployedApp } from "@/lib/deploy";

export function BetaBanner() {
  if (!isDeployedApp()) return null;

  return (
    <div className="shrink-0 border-b border-dart-green/40 bg-dart-green/15 px-4 py-2 text-center text-xs text-dart-cream">
      <span className="font-semibold uppercase tracking-wide text-dart-green">
        Beta
      </span>
      <span className="mx-2 opacity-40">·</span>
      <span className="text-dart-muted">
        Testversion — del linket med venner på mobil
      </span>
    </div>
  );
}

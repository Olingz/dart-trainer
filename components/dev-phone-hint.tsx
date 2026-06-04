"use client";

import { useEffect, useState } from "react";

function isLocalDevHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.")
  );
}

/** Hjælp til Supabase-URLs når du tester fra telefon eller lokalt netværk. */
export function DevPhoneHint({ callbackUrl }: { callbackUrl: string }) {
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    const { hostname } = window.location;
    if (!isLocalDevHost(hostname)) return;
    setOrigin(window.location.origin);
  }, []);

  if (!origin) return null;

  const isLanIp = origin.includes("192.168.");

  return (
    <div className="mt-6 rounded-xl border border-dart-green/50 bg-dart-green/10 p-3 text-left text-xs text-dart-cream">
      <p className="font-semibold text-dart-green">Supabase (lokal test)</p>

      {isLanIp && (
        <p className="mt-2 text-dart-red">
          <strong>Mobil:</strong> Site URL skal være{" "}
          <code className="break-all">{origin}</code> — ikke 127.0.0.1 (virker
          kun på PC).
        </p>
      )}

      <p className="mt-2 text-dart-muted">
        Google sender dig tilbage til:
        <br />
        <code className="break-all text-dart-cream">{callbackUrl}</code>
      </p>

      <p className="mt-2 text-dart-muted">
        Redirect URLs skal indeholde:
        <br />
        <code className="break-all">{callbackUrl}</code>
        <br />
        <code className="break-all">{origin}</code>
      </p>
    </div>
  );
}

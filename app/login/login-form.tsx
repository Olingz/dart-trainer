"use client";

import { DevPhoneHint } from "@/components/dev-phone-hint";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth-errors";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

const inputClass =
  "min-h-12 rounded-xl border-2 border-dart-wire bg-dart-black px-4 text-base text-dart-cream outline-none focus:border-dart-red";

function getAppOrigin() {
  if (typeof window === "undefined") return "http://127.0.0.1:3000";
  if (window.location.hostname === "0.0.0.0") {
    return `http://127.0.0.1:${window.location.port || "3000"}`;
  }
  return window.location.origin;
}

function getCallbackUrl(next: string | null) {
  const origin = getAppOrigin();
  const path = "/auth/callback";
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return `${origin}${path}?next=${encodeURIComponent(next)}`;
  }
  return `${origin}${path}`;
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const authError = searchParams.get("error") === "auth";
  const authMessage = searchParams.get("message");
  const callbackUrl = getCallbackUrl(next);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"google" | "apple" | "email" | null>(
    null,
  );
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(
    authError
      ? authMessage
        ? authMessage
        : "Login mislykkedes. Prøv igen."
      : null,
  );

  async function signInWithOAuth(provider: "google" | "apple") {
    setLoading(provider);
    setError(null);

    const supabase = createClient();
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl,
        skipBrowserRedirect: true,
      },
    });

    if (oauthError) {
      setError(formatAuthError(oauthError.message));
      setLoading(null);
      return;
    }

    if (!data?.url) {
      setError("Kunne ikke starte login. Tjek Supabase-indstillinger.");
      setLoading(null);
      return;
    }

    const currentHost = window.location.hostname;
    const wrongLocalhost =
      currentHost.startsWith("192.168.") &&
      (data.url.includes("127.0.0.1") || data.url.includes("localhost"));

    if (wrongLocalhost) {
      setError(
        `Supabase Site URL er sandsynligvis sat til 127.0.0.1. Skift Site URL til ${getAppOrigin()} og gem. Callback skal være: ${callbackUrl}`,
      );
      setLoading(null);
      return;
    }

    window.location.href = data.url;
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    setLoading("email");
    setError(null);
    setLinkSent(false);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callbackUrl,
      },
    });

    setLoading(null);

    if (signInError) {
      setError(formatAuthError(signInError.message));
      return;
    }

    setLinkSent(true);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-4 py-8">
      <div className="mx-auto w-full max-w-sm">
        <header className="text-center">
          <p className="font-display text-2xl tracking-widest text-dart-red">
            301
          </p>
          <h1 className="font-display mt-0 text-4xl leading-none text-dart-cream">
            Dart Trainer
          </h1>
        </header>
        <p className="mt-4 text-center text-base text-dart-muted">
          Log ind — ét tryk, så husker vi dig ved skiven
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => signInWithOAuth("google")}
            className="flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-dart-wire bg-dart-cream px-4 text-lg font-semibold text-dart-black transition-opacity disabled:opacity-50"
          >
            <GoogleIcon />
            {loading === "google" ? "Åbner Google…" : "Fortsæt med Google"}
          </button>

          <button
            type="button"
            disabled={loading !== null}
            onClick={() => signInWithOAuth("apple")}
            className="flex min-h-14 items-center justify-center gap-3 rounded-xl border-2 border-dart-wire bg-dart-black px-4 text-lg font-semibold text-dart-cream transition-opacity disabled:opacity-50"
          >
            <AppleIcon />
            {loading === "apple" ? "Åbner Apple…" : "Fortsæt med Apple"}
          </button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-dart-wire" />
          <span className="text-xs uppercase tracking-wide text-dart-muted">
            eller e-mail
          </span>
          <div className="h-px flex-1 bg-dart-wire" />
        </div>

        {linkSent ? (
          <div className="dart-panel rounded-xl p-4 text-center">
            <p className="font-medium text-dart-cream">Tjek din e-mail</p>
            <p className="mt-2 text-sm text-dart-muted">
              Tryk på login-linket — du kommer automatisk tilbage til appen.
              Ingen kode at indtaste.
            </p>
            <button
              type="button"
              onClick={() => {
                setLinkSent(false);
                setEmail("");
              }}
              className="mt-4 text-sm text-dart-muted underline"
            >
              Brug anden e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-dart-cream">
                E-mail (login-link)
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dig@eksempel.dk"
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              disabled={loading !== null}
              className="font-display min-h-12 rounded-xl border-2 border-dart-cream bg-dart-green px-4 text-xl text-dart-cream disabled:opacity-50"
            >
              {loading === "email" ? "Sender link…" : "Send login-link"}
            </button>
          </form>
        )}

        {error && <p className="mt-4 text-sm text-dart-red">{error}</p>}

        <DevPhoneHint callbackUrl={callbackUrl} />

        <p className="mt-8 text-center text-xs leading-relaxed text-dart-muted">
          Efter første login bliver du logget ind automatisk på denne telefon.
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSafeOrigin } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

function loginWithAuthError(origin: string, message: string) {
  const url = new URL(`${origin}/login`);
  url.searchParams.set("error", "auth");
  url.searchParams.set("message", message);
  return NextResponse.redirect(url.toString());
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const origin = getSafeOrigin(requestUrl);
  const next = searchParams.get("next") ?? "/";
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (providerError) {
    return loginWithAuthError(origin, providerError);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return loginWithAuthError(
      origin,
      error.message ||
        "Kunne ikke fuldføre login. Tjek at Supabase Site URL matcher appens adresse.",
    );
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return loginWithAuthError(origin, error.message);
  }

  return loginWithAuthError(origin, "Manglende login-kode fra Supabase.");
}

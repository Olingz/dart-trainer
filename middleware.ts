import { NextResponse, type NextRequest } from "next/server";

import { getSafeOrigin } from "@/lib/app-url";
import { updateSession } from "@/lib/supabase/middleware";

/** Supabase sender nogle gange ?code= til Site URL (/) i stedet for /auth/callback. */
function redirectOAuthCodeToCallback(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/auth/callback")) {
    return null;
  }

  // Kun ?code= / ?token_hash= — ikke ?error= (undgår loop med /login?error=auth)
  const hasCode = searchParams.has("code") || searchParams.has("token_hash");
  const hasProviderError =
    searchParams.has("error") && (pathname === "/" || pathname === "");

  if (!hasCode && !hasProviderError) {
    return null;
  }

  const safeOrigin = getSafeOrigin(request.url);
  const callbackUrl = new URL(`${safeOrigin}/auth/callback`);
  request.nextUrl.searchParams.forEach((value, key) => {
    callbackUrl.searchParams.set(key, value);
  });
  return NextResponse.redirect(callbackUrl);
}

export async function middleware(request: NextRequest) {
  const oauthRedirect = redirectOAuthCodeToCallback(request);
  if (oauthRedirect) {
    return oauthRedirect;
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

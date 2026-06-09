import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/login", "/auth"];

function getSafeOrigin(url: string | URL): string {
  const parsed = typeof url === "string" ? new URL(url) : url;
  if (parsed.hostname === "0.0.0.0") {
    const port = parsed.port || "3000";
    return `http://127.0.0.1:${port}`;
  }
  return parsed.origin;
}

function isPublicPath(pathname: string) {
  return publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function missingEnvResponse() {
  const html = `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opsætning mangler</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:2rem auto;padding:0 1rem;line-height:1.5}code{background:#f4f4f4;padding:.15rem .35rem;border-radius:4px;font-size:.9em}</style>
</head>
<body>
<h1>Supabase er ikke konfigureret på Vercel</h1>
<p>Tilføj <code>NEXT_PUBLIC_SUPABASE_URL</code> og <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> under Vercel → Settings → Environment Variables (Production), og <strong>Redeploy</strong>.</p>
</body></html>`;
  return new NextResponse(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function redirectOAuthCodeToCallback(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/auth/callback")) {
    return null;
  }

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

async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return missingEnvResponse();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return supabaseResponse;
}

export async function middleware(request: NextRequest) {
  try {
    const oauthRedirect = redirectOAuthCodeToCallback(request);
    if (oauthRedirect) {
      return oauthRedirect;
    }
    return await updateSession(request);
  } catch (error) {
    console.error("Middleware error:", error);
    return new NextResponse("Serverfejl. Prøv at redeploy på Vercel.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnvOrNull } from "../env";

const publicPaths = ["/login", "/auth"];

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
<p>Tilføj disse <strong>Environment Variables</strong> under Vercel → Settings → Environment Variables (huk <strong>Production</strong> af):</p>
<ul>
<li><code>NEXT_PUBLIC_SUPABASE_URL</code></li>
<li><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code></li>
</ul>
<p>Værdierne findes i Supabase → Project Settings → API.</p>
<p>Efter du har gemt variablerne: <strong>Deployments → Redeploy</strong> (uden dem virker appen ikke).</p>
</body></html>`;

  return new NextResponse(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnvOrNull();
  if (!env) {
    return missingEnvResponse();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.anonKey, {
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

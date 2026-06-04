import { NextResponse } from "next/server";

import { getSafeOrigin } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const origin = getSafeOrigin(new URL(request.url));
  return NextResponse.redirect(`${origin}/login`, { status: 302 });
}

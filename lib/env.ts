export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export function getSupabaseEnvOrNull(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function getSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnvOrNull();

  if (!env) {
    throw new Error(
      "Manglende Supabase-miljøvariabler. Kopier .env.example til .env.local og udfyld NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return env;
}

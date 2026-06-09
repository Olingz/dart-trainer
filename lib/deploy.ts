/** Kører på Vercel (beta/produktion) — ikke localhost. */
export function isDeployedApp(): boolean {
  return Boolean(process.env.VERCEL);
}

export function getDeployUrl(): string | null {
  const vercelUrl = process.env.VERCEL_URL;
  if (!vercelUrl) return null;
  return `https://${vercelUrl}`;
}

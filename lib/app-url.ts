/** Browsere kan ikke åbne http://0.0.0.0 — brug localhost/127.0.0.1 i stedet. */
export function getSafeOrigin(url: string | URL): string {
  const parsed = typeof url === "string" ? new URL(url) : url;

  if (parsed.hostname === "0.0.0.0") {
    const port = parsed.port || "3000";
    return `http://127.0.0.1:${port}`;
  }

  return parsed.origin;
}

export function getSafeClientOrigin(): string {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:3000";
  }

  return getSafeOrigin(window.location.href);
}

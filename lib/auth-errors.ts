export function formatAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "For mange login-mails på kort tid. Vent typisk 30–60 minutter, eller hæv grænsen i Supabase under Authentication → Rate Limits.";
  }

  if (lower.includes("expired") || lower.includes("invalid")) {
    return "Koden eller linket er udløbet. Tryk «Send kode» igen (når rate limit er væk).";
  }

  if (lower.includes("signup") && lower.includes("confirm")) {
    return "Bekræft din e-mail via linket i mailen, eller brug Google/Apple-login.";
  }

  if (lower.includes("provider") || lower.includes("oauth")) {
    return "Denne login-metode er ikke aktiveret endnu. Aktivér Google eller Apple under Supabase → Authentication → Providers.";
  }

  return message;
}

const DATE_LOCALE = "en-AU";

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString(DATE_LOCALE, { day: "2-digit", month: "short", year: "numeric" });
}

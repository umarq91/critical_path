// Suggestions only, not a closed list — `public_holidays.country` is plain text (see
// 0027_public_holidays.sql), so a country outside this list is still a valid value, just one
// the create form and CSV template don't pre-fill a friendly label for.
export const KNOWN_HOLIDAY_COUNTRIES = [
  { code: "AU", label: "Australia" },
  { code: "CN", label: "China" },
  { code: "IN", label: "India" },
  { code: "TR", label: "Türkiye" },
] as const;

/** "AU" → "Australia"; a country outside the known list is shown exactly as it was typed. */
export function holidayCountryLabel(country: string) {
  return KNOWN_HOLIDAY_COUNTRIES.find((known) => known.code === country.trim().toUpperCase())?.label ?? country;
}

/** How a holiday is titled wherever it is shown (client request): "Australia - New Year's Day".
 *  Display only — `public_holidays.name` stays the bare event name. */
export function formatHolidayTitle(holiday: { country: string; name: string }) {
  return `${holidayCountryLabel(holiday.country)} - ${holiday.name}`;
}

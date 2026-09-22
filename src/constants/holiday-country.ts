// Suggestions only, not a closed list — `public_holidays.country` is plain text (see
// 0027_public_holidays.sql), so a country outside this list is still a valid value, just one
// the create form and CSV template don't pre-fill a friendly label for.
export const KNOWN_HOLIDAY_COUNTRIES = [
  { code: "AU", label: "Australia" },
  { code: "CN", label: "China" },
  { code: "IN", label: "India" },
  { code: "TR", label: "Türkiye" },
] as const;

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Avatar fallback initials — shared by anywhere a person's avatar can render (UserMenu,
// task assignee cells, ...) so the "up to 2 initials from name, else email" rule lives once.
export function initials(name: string | null | undefined, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

// PostgREST's `.or()` filter string uses commas to separate conditions and parentheses for
// grouping, so a raw search term containing either would corrupt the filter syntax — or smuggle
// an extra condition into the query. Strip them before interpolating a term into one.
// `.ilike()` and friends bind their argument and need no such treatment.
export function sanitiseOrSearchTerm(value: string) {
  return value.replace(/[,()]/g, "").trim();
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// For ids that arrive from a URL or saved filter: an invalid uuid errors the whole Postgres query
// (22P02), and an id interpolated into an `.or()` string could otherwise smuggle in a condition.
export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

// Case-insensitive, number-aware label order ("Q2'27" before "Q10'27", "RJ'S" beside "RJ's") —
// Postgres's `order by` on these columns follows the DB collation, which isn't the A–Z people expect.
export function compareLabels(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

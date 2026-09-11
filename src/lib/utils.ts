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

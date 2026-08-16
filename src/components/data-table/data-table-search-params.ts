// Shared between the client hook (use-data-table-query-state.ts) and Server Components
// that need to read the exact same URL state (e.g. seasons/page.tsx, to run the matching
// Supabase query). Imports from "nuqs/server", not "nuqs" — the main "nuqs" package entry
// is marked "use client", so importing it from a module a Server Component pulls in turns
// every export into an inert client-reference proxy (parseAsInteger.withDefault stops being
// a function). "nuqs/server" re-exports the same underlying parsers with no such boundary,
// safe in both server and client code.
import { createLoader, parseAsInteger, parseAsJson, parseAsString } from "nuqs/server";
import { z } from "zod";

const filtersSchema = z.record(z.string(), z.string());

function parseFilters(value: unknown): Record<string, string> | null {
  const result = filtersSchema.safeParse(value);
  return result.success ? result.data : null;
}

export interface DataTableSearchParamsOptions {
  defaultPageSize?: number;
  defaultSort?: { id: string; desc: boolean };
}

export function dataTableSearchParams({ defaultPageSize = 10, defaultSort }: DataTableSearchParamsOptions = {}) {
  return {
    page: parseAsInteger.withDefault(1),
    pageSize: parseAsInteger.withDefault(defaultPageSize),
    sortBy: parseAsString.withDefault(defaultSort?.id ?? ""),
    sortDir: parseAsString.withDefault(defaultSort?.desc ? "desc" : "asc"),
    filters: parseAsJson(parseFilters).withDefault({}),
  };
}

export type DataTableSearchParams = ReturnType<typeof dataTableSearchParams>;

// Server Components: `const state = await loadDataTableSearchParams(searchParams, opts)`.
// Accepts the raw (still-a-promise) `searchParams` page prop directly — nuqs resolves it.
export function loadDataTableSearchParams(
  searchParams: Promise<Record<string, string | string[] | undefined>>,
  options?: DataTableSearchParamsOptions
) {
  return createLoader(dataTableSearchParams(options))(searchParams);
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MAX_LOOKUP_EXPORT_ROWS } from "@/lib/export/types";
import { brandStatusValues, type BrandInput } from "@/app/(app)/brands/schema";

export interface ListBrandsParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SORTABLE_COLUMNS = new Set(["brand_name", "status", "created_at"]);

function isBrandStatus(value: string | undefined): value is BrandInput["status"] {
  return !!value && (brandStatusValues as readonly string[]).includes(value);
}

export async function listBrands({ page = 1, pageSize = 15, sortBy, sortDir, filters = {} }: ListBrandsParams = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("brands")
    .select("*", { count: "exact" })
    .is("deleted_at", null);

  if (filters.brand_name) query = query.ilike("brand_name", `%${filters.brand_name}%`);
  if (isBrandStatus(filters.status)) query = query.eq("status", filters.status);

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "brand_name";
  query = query.order(orderColumn, { ascending: sortDir !== "desc" });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  return { data: data ?? [], rowCount: count ?? 0 };
}

export type Brand = Awaited<ReturnType<typeof listBrands>>["data"][number];

// The Brands admin page's export — same filters/sort as the board, whole matching scope
// rather than one page. See listSeasonsForExport's comment: small admin lookup table, so a
// single MAX_LOOKUP_EXPORT_ROWS-sized page of listBrands() is enough, no chunked fetch loop.
export async function listBrandsForExport(params: Omit<ListBrandsParams, "page" | "pageSize"> = {}) {
  const { data, rowCount } = await listBrands({ ...params, page: 1, pageSize: MAX_LOOKUP_EXPORT_ROWS });
  return { data, rowCount, truncated: rowCount > MAX_LOOKUP_EXPORT_ROWS };
}

// The brand leg of the task grid's search box: ids whose name matches a free-text term.
// Unlike listBrandOptions this does NOT filter to active brands — a task can belong to a brand
// that has since been deactivated, and it should still be findable by that brand's name.
export async function listBrandIdsMatching(term: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id")
    .is("deleted_at", null)
    .ilike("brand_name", `%${term}%`);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.id));
}

// Options for pickers that link another entity to a brand (e.g. the task form/filters) —
// id/name only, every non-deleted, active brand.
export async function listBrandOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, brand_name")
    .is("deleted_at", null)
    .eq("status", "active")
    .order("brand_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

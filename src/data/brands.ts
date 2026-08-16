import "server-only";
import { createClient } from "@/lib/supabase/server";
import { brandStatusValues, type BrandInput } from "@/app/(app)/brands/schema";

export interface ListBrandsParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>;
}

const SORTABLE_COLUMNS = new Set(["brand_name", "brand_code", "status", "created_at"]);

function isBrandStatus(value: string | undefined): value is BrandInput["status"] {
  return !!value && (brandStatusValues as readonly string[]).includes(value);
}

export async function listBrands({ page = 1, pageSize = 15, sortBy, sortDir, filters = {} }: ListBrandsParams = {}) {
  const supabase = await createClient();
  let query = supabase
    .from("brands")
    .select("*, season:seasons(id, season_name, color)", { count: "exact" })
    .is("deleted_at", null);

  if (filters.brand_name) query = query.ilike("brand_name", `%${filters.brand_name}%`);
  if (isBrandStatus(filters.status)) query = query.eq("status", filters.status);
  if (filters.season_id) query = query.eq("season_id", filters.season_id);

  const orderColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "brand_name";
  query = query.order(orderColumn, { ascending: sortDir !== "desc" });

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;

  return { data: data ?? [], rowCount: count ?? 0 };
}

export type Brand = Awaited<ReturnType<typeof listBrands>>["data"][number];

// Stat cards — must reflect the whole dataset, not whatever page listBrands() currently has
// loaded, so this is a separate, narrow-column query rather than derived from the page.
export async function listBrandSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("brands").select("status, created_at").is("deleted_at", null);
  if (error) throw error;

  const rows = data ?? [];
  const currentYear = new Date().getFullYear();
  const statusCounts = Object.fromEntries(brandStatusValues.map((status) => [status, 0])) as Record<
    (typeof brandStatusValues)[number],
    number
  >;
  let addedThisYear = 0;

  for (const row of rows) {
    statusCounts[row.status]++;
    if (new Date(row.created_at).getFullYear() === currentYear) addedThisYear++;
  }

  return { total: rows.length, statusCounts, addedThisYear };
}

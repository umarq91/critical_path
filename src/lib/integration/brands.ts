import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeCursor, type IntegrationCursor } from "@/lib/integration/cursor";

export interface ListBrandsForIntegrationParams {
  pageSize: number;
  cursor: IntegrationCursor | null;
  updatedSince: string | null;
  includeDeleted: boolean;
}

const BRAND_SELECT = "id, brand_code, brand_name, description, status, updated_at, deleted_at";

export interface IntegrationBrandRow {
  id: string;
  brand_code: string;
  brand_name: string;
  description: string | null;
  status: string;
  updated_at: string;
  deleted_at: string | null;
}

// Backs GET /integration/v1/brands — same shape and same reasoning as
// lib/integration/seasons.ts (its sibling, built first): every spec field maps to a real
// column except `version`, sent as `null` rather than invented. Service-role client for the
// same reason every integration read uses it — the caller has no Supabase session, and
// `brands`' own RLS is scoped `to authenticated` only.
export async function listBrandsForIntegration({
  pageSize,
  cursor,
  updatedSince,
  includeDeleted,
}: ListBrandsForIntegrationParams): Promise<{ rows: IntegrationBrandRow[]; nextCursor: string | null }> {
  const supabase = createAdminClient();

  let query = supabase.from("brands").select(BRAND_SELECT);
  if (!includeDeleted) query = query.is("deleted_at", null);
  if (updatedSince) query = query.gte("updated_at", updatedSince);

  // Keyset pagination — see lib/integration/cursor.ts for why (updated_at, id) and why the
  // cursor is validated before it ever reaches this string.
  if (cursor) {
    query = query.or(`updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`);
  }

  const { data, error } = await query
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(pageSize + 1);
  if (error) throw error;

  const rows = (data ?? []) as IntegrationBrandRow[];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null;

  return { rows: page, nextCursor };
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeCursor, type IntegrationCursor } from "@/lib/integration/cursor";

export interface ListSeasonsForIntegrationParams {
  pageSize: number;
  cursor: IntegrationCursor | null;
  updatedSince: string | null;
  includeDeleted: boolean;
}

const SEASON_SELECT = "id, season_code, season_name, status, start_date, end_date, updated_at, deleted_at";

export interface IntegrationSeasonRow {
  id: string;
  season_code: string;
  season_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
  deleted_at: string | null;
}

// Backs GET /integration/v1/seasons — the first real data endpoint (see
// things-to-know.md's Integrations section for why this one and not /tasks first: every
// spec field here maps to a real column except `version`, which this schema doesn't track and
// the response sends as `null` rather than inventing). Uses the service-role client, same
// reasoning as requireIntegrationApiKey() — the caller has no Supabase session, and
// `seasons`' own RLS is scoped `to authenticated` only.
export async function listSeasonsForIntegration({
  pageSize,
  cursor,
  updatedSince,
  includeDeleted,
}: ListSeasonsForIntegrationParams): Promise<{ rows: IntegrationSeasonRow[]; nextCursor: string | null }> {
  const supabase = createAdminClient();

  let query = supabase.from("seasons").select(SEASON_SELECT);
  if (!includeDeleted) query = query.is("deleted_at", null);
  if (updatedSince) query = query.gte("updated_at", updatedSince);

  // Keyset pagination: strictly after the cursor's (updated_at, id) pair — see
  // lib/integration/cursor.ts for why that pair and why it's validated before reaching here.
  if (cursor) {
    query = query.or(`updated_at.gt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.gt.${cursor.id})`);
  }

  // One extra row fetched, not returned, so "is there a next page" is known without a second
  // count query — same trick data/parties.ts's searchParties uses for its own `truncated` flag.
  const { data, error } = await query
    .order("updated_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(pageSize + 1);
  if (error) throw error;

  const rows = (data ?? []) as IntegrationSeasonRow[];
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ updatedAt: last.updated_at, id: last.id }) : null;

  return { rows: page, nextCursor };
}

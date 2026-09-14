import "server-only";

// Every /integration/v1/* list endpoint pages the same way: keyset on (updated_at, id)
// ascending, not the app's usual offset page/pageSize — the spec calls for a real opaque
// cursor Databricks re-submits verbatim (`?cursor=...`), and offset pagination would double-
// count or skip rows on a table that's still being written to mid-sync. (updated_at, id) is
// the tiebreaker pair because updated_at repeats (a bulk edit touches many rows in the same
// transaction); id alone breaks the tie deterministically, same reasoning data/tasks.ts's own
// `.order("id")` note gives for the grid.
export interface IntegrationCursor {
  updatedAt: string;
  id: string;
}

export function encodeCursor(cursor: IntegrationCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Returns null for anything that doesn't decode to a well-formed cursor — a garbled or
// hand-edited one should read as "start from the beginning," not a 500. The format checks
// (not just "is a string") matter beyond robustness: `updatedAt`/`id` get interpolated
// straight into a PostgREST `.or()` filter string below, the same place `sanitiseOrSearchTerm`
// exists elsewhere in this codebase to keep untrusted input out of — validating shape here is
// that same guard, applied before the value ever reaches a query instead of stripping
// characters from it after.
export function decodeCursor(raw: string | null): IntegrationCursor | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
    if (
      parsed &&
      typeof parsed === "object" &&
      ISO_TIMESTAMP.test((parsed as IntegrationCursor).updatedAt) &&
      UUID.test((parsed as IntegrationCursor).id)
    ) {
      return parsed as IntegrationCursor;
    }
  } catch {
    // Falls through to null below.
  }
  return null;
}

export const DEFAULT_PAGE_SIZE = 500;
export const MAX_PAGE_SIZE = 2000;

// Clamps an untrusted `page_size` query param into the spec's stated bounds — a request for
// 0, a negative number, or something non-numeric all fall back to the default rather than
// erroring, since this is a read-only convenience param, not something worth rejecting a whole
// sync run over.
export function clampPageSize(raw: string | null): number {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.trunc(parsed), MAX_PAGE_SIZE);
}

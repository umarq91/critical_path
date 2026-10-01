// A sync is planned once, then pushed in batches of this many items, one Server Action call per
// batch: each call stays far inside the request time limit, and the browser can show progress
// between them. planGoogleCalendarSync hands this to the browser loop with the plan.
export const SYNC_BATCH_SIZE = 25;

export type SyncItemKind = "task" | "holiday";

export interface SyncItem {
  kind: SyncItemKind;
  id: string;
}

/** A skipped or failed item, as the progress dialog lists it. */
export interface SyncResultItem {
  name: string;
  reason: string;
}

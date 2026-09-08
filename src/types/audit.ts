import type { ParticipantRole } from "@/lib/party";

// Shape of `audit_log.changes`. Deliberately a plain, already-rendered structure: every value
// is the string the UI shows, resolved at write time (a season FK becomes "SS26", not a uuid).
// Reading the log must never need a second round trip to make a row legible — and a label
// captured at write time still tells the truth after the thing it named is renamed or deleted.
// A type alias, not an interface, on purpose: only aliases get TypeScript's implicit index
// signature, which is what lets these be written straight into a `jsonb` (Json) column.
export type AuditFieldChange = {
  field: string;
  from: string | null;
  to: string | null;
}

/** Party names added and removed for ONE participant role, within one save. */
export type AuditPartyChange = {
  role: ParticipantRole;
  added: string[];
  removed: string[];
};

export type AuditChanges = {
  /** Field-level diff — `task.update`. Only fields the patch actually changed. */
  fields?: AuditFieldChange[];
  /** `task.participants_change`. An array, one entry per role touched, because owners and
   *  people involved are saved together from the detail drawer — changing both must read as
   *  one event, not two rows that happen to share a timestamp. */
  parties?: AuditPartyChange[];
  /** The owners a task was created with — `task.create`. */
  owners?: string[];
  /** Rows written by 0020's backfill from `tasks`' tracking columns. Those columns record
   *  that an edit happened, by whom and when, but not what changed — so the UI says so
   *  rather than rendering an empty diff and implying nothing was touched. */
  backfilled?: boolean;
};

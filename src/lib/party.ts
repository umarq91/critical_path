import type { Database } from "@/types/supabase";

export type PartyKind = "user" | "department";
export type ParticipantRole = Database["public"]["Enums"]["task_participant_role"];

// A task participant is either a profile or a department (task_participants' polymorphic
// profile_id/department_id pair). Form controls, option lists and React keys all need a single
// scalar to identify one, so a party is addressed by a `kind:uuid` string everywhere on the
// client and split back into the right column on write.
export interface PartyRef {
  kind: PartyKind;
  id: string;
}

export type PartyKey = `${PartyKind}:${string}`;

export function partyKey({ kind, id }: PartyRef): PartyKey {
  return `${kind}:${id}`;
}

export function parsePartyKey(value: string): PartyRef | null {
  const separator = value.indexOf(":");
  if (separator === -1) return null;

  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (kind !== "user" && kind !== "department") return null;
  if (!id) return null;

  return { kind, id };
}

// The two nullable FK columns a PartyRef writes to. Mirrors the migration's
// `check (num_nonnulls(profile_id, department_id) = 1)` — exactly one is ever set.
export function partyColumns({ kind, id }: PartyRef) {
  return kind === "user" ? { profile_id: id, department_id: null } : { profile_id: null, department_id: id };
}

// Turns the form's `kind:uuid` keys into task_participants rows. Unparseable keys are dropped
// rather than failing the whole write — the zod schema already rejected them upstream, so
// anything reaching here is a bug, not user input worth surfacing an error for.
//
// Lives here rather than in a `_actions.ts` because both createTask and the participant
// actions build these, and a "use server" module can only export Server Actions.
export function participantRows(taskId: string, keys: string[], role: ParticipantRole) {
  return keys.flatMap((key) => {
    const party = parsePartyKey(key);
    return party ? [{ task_id: taskId, role, ...partyColumns(party) }] : [];
  });
}

// One row in a party picker or party list — a department or a person, rendered by the same
// component. The optional fields are the ones only one kind has; the UI branches on `kind`,
// not on presence. Lives here rather than in data/parties.ts so Client Components can import
// the type without reaching into a `server-only` module.
export interface PartySummary extends PartyRef {
  key: PartyKey;
  name: string;
  /** People: their email (and department). Departments: their description, or an external note. */
  subtitle: string | null;
  avatarUrl: string | null;
  isExternal: boolean;
}

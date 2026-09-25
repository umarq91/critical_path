"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setTaskParticipants } from "@/app/(app)/tasks/_participant-actions";
import { taskOwners, taskPeopleInvolved } from "@/app/(app)/tasks/task-parties";
import { isSameSet } from "@/app/(app)/tasks/use-participants-draft";
import type { PartySummary } from "@/lib/party";
import type { Task } from "@/data/tasks";

export type ParticipantList = "owners" | "people";

interface RowParticipantsDraft {
  taskId: string;
  owners: PartySummary[];
  people: PartySummary[];
  baseline: { owners: PartySummary[]; people: PartySummary[] };
}

export type ParticipantsSaveResult = "saved" | "unchanged" | "failed";

// The grid's inline counterpart of useParticipantsDraft (the drawer's): Owners + People Involved
// for the ONE row in pencil/tick edit mode, buffered until the tick and then written through
// setTaskParticipants in a single call — same one-write-path, one-audit-entry rule as the drawer.
// Lives beside useRowEditing rather than inside its draft because a party needs its name and
// avatar to render, not just the `kind:uuid` key the string draft could hold.
export function useRowParticipants() {
  const [draft, setDraft] = useState<RowParticipantsDraft | null>(null);

  function start(task: Task) {
    const owners = taskOwners(task);
    const people = taskPeopleInvolved(task);
    setDraft({ taskId: task.id, owners, people, baseline: { owners, people } });
  }

  function add(list: ParticipantList, party: PartySummary) {
    setDraft((prev) =>
      prev && !prev[list].some((existing) => existing.key === party.key)
        ? { ...prev, [list]: [...prev[list], party] }
        : prev
    );
  }

  function remove(list: ParticipantList, party: PartySummary) {
    setDraft((prev) => (prev ? { ...prev, [list]: prev[list].filter((existing) => existing.key !== party.key) } : prev));
  }

  function clear() {
    setDraft(null);
  }

  async function save(): Promise<ParticipantsSaveResult> {
    if (!draft) return "unchanged";
    const isDirty = !isSameSet(draft.owners, draft.baseline.owners) || !isSameSet(draft.people, draft.baseline.people);
    if (!isDirty) return "unchanged";

    if (draft.owners.length === 0) {
      toast.error("A task must have at least one owner");
      return "failed";
    }

    const result = await setTaskParticipants(draft.taskId, {
      owners: draft.owners.map((party) => party.key),
      people_involved: draft.people.map((party) => party.key),
    });
    if (!result.ok) {
      toast.error(result.error);
      return "failed";
    }
    // Re-based so that if the row's own fields then fail to save, the retry tick doesn't
    // rewrite (and re-log) participants that already landed.
    setDraft((prev) => (prev ? { ...prev, baseline: { owners: prev.owners, people: prev.people } } : prev));
    return "saved";
  }

  return {
    draft,
    draftFor: (taskId: string) => (draft?.taskId === taskId ? draft : null),
    start,
    add,
    remove,
    clear,
    save,
  };
}

export type RowParticipantsState = ReturnType<typeof useRowParticipants>;

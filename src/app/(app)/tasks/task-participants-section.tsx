"use client";

import { useState } from "react";
import { toast } from "sonner";
import { addTaskParticipant, removeTaskParticipant } from "@/app/(app)/tasks/_actions";
import { PartyListField } from "@/app/(app)/tasks/party-list-field";
import type { ParticipantRole, PartySummary } from "@/lib/party";

// Collapses the list behind "Show all N" past this many rows — keeps the Task Details drawer
// from growing unbounded on a task with a lot of parties on it.
const MAX_VISIBLE_PARTIES = 6;

interface TaskParticipantsSectionProps {
  taskId: string;
  role: ParticipantRole;
  initialParties: PartySummary[];
  canManage: boolean;
  emptyLabel: string;
}

// Server-backed sibling of the plain, controlled PartyListField — used by the Task Details
// drawer, where the task already exists so add/remove hit task_participants directly
// (optimistic update, rolled back on failure) instead of buffering locally like the create
// form does. Render with `key={task.id}` from the caller so switching between tasks resets
// this component's local state instead of carrying over the previous task's list.
export const TaskParticipantsSection = ({
  taskId,
  role,
  initialParties,
  canManage,
  emptyLabel,
}: TaskParticipantsSectionProps) => {
  const [parties, setParties] = useState(initialParties);

  async function handleAdd(party: PartySummary) {
    setParties((prev) => (prev.some((existing) => existing.key === party.key) ? prev : [...prev, party]));

    const result = await addTaskParticipant(taskId, party.key, role);
    if (!result.ok) {
      setParties((prev) => prev.filter((existing) => existing.key !== party.key));
      toast.error(result.error);
      return;
    }
    toast.success(`${party.name} added`);
  }

  async function handleRemove(party: PartySummary) {
    setParties((prev) => prev.filter((existing) => existing.key !== party.key));

    const result = await removeTaskParticipant(taskId, party.key, role);
    if (!result.ok) {
      setParties((prev) => (prev.some((existing) => existing.key === party.key) ? prev : [...prev, party]));
      toast.error(result.error);
      return;
    }

    toast.success(`${party.name} removed`, {
      action: {
        label: "Undo",
        onClick: () => {
          setParties((prev) => (prev.some((existing) => existing.key === party.key) ? prev : [...prev, party]));
          void addTaskParticipant(taskId, party.key, role);
        },
      },
    });
  }

  return (
    <PartyListField
      parties={parties}
      onAdd={handleAdd}
      onRemove={handleRemove}
      disabled={!canManage}
      emptyLabel={emptyLabel}
      maxVisible={MAX_VISIBLE_PARTIES}
    />
  );
};

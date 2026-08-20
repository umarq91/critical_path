"use client";

import { useState } from "react";
import { toast } from "sonner";
import { addTaskPerson, removeTaskPerson } from "@/app/(app)/tasks/_actions";
import { PeopleInvolvedField } from "@/app/(app)/tasks/people-involved-field";
import type { PersonSummary } from "@/app/(app)/tasks/person-row";

// Collapses the added-people list behind "Show all N people" past this many rows — keeps the
// Task Details drawer from growing unbounded for tasks with a lot of people on them.
const MAX_VISIBLE_PEOPLE = 6;

interface TaskPeopleSectionProps {
  taskId: string;
  initialPeople: PersonSummary[];
  canManage: boolean;
}

// Server-backed sibling of the plain, controlled PeopleInvolvedField — used by the Task
// Details drawer, where the task already exists so add/remove call task_people directly
// (optimistic update, rolled back on failure) instead of buffering locally like the
// create-task form does. Render with `key={task.id}` from the caller so switching between
// tasks resets this component's local state instead of carrying over the previous task's list.
export const TaskPeopleSection = ({ taskId, initialPeople, canManage }: TaskPeopleSectionProps) => {
  const [people, setPeople] = useState(initialPeople);

  async function handleAdd(person: PersonSummary) {
    setPeople((prev) => (prev.some((existing) => existing.id === person.id) ? prev : [...prev, person]));

    const result = await addTaskPerson(taskId, person.id);
    if (!result.ok) {
      setPeople((prev) => prev.filter((existing) => existing.id !== person.id));
      toast.error(result.error);
      return;
    }
    toast.success(`${person.full_name ?? person.email} added`);
  }

  async function handleRemove(person: PersonSummary) {
    setPeople((prev) => prev.filter((existing) => existing.id !== person.id));

    const result = await removeTaskPerson(taskId, person.id);
    if (!result.ok) {
      setPeople((prev) => (prev.some((existing) => existing.id === person.id) ? prev : [...prev, person]));
      toast.error(result.error);
      return;
    }

    toast.success(`${person.full_name ?? person.email} removed`, {
      action: {
        label: "Undo",
        onClick: () => {
          setPeople((prev) => (prev.some((existing) => existing.id === person.id) ? prev : [...prev, person]));
          void addTaskPerson(taskId, person.id);
        },
      },
    });
  }

  return (
    <PeopleInvolvedField
      people={people}
      onAdd={handleAdd}
      onRemove={handleRemove}
      disabled={!canManage}
      maxVisible={MAX_VISIBLE_PEOPLE}
    />
  );
};

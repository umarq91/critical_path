"use client";

import { useEffect, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { TASK_LINK_PARAM } from "@/constants/routes";
import type { Task } from "@/data/tasks";

// The task drawer's open state, seeded from a `?task=<id>` link (e.g. a reminder email), shared by
// Tasks and My Tasks. `linkedTask` is the server's lookup of that id: null when there was no link,
// or when the task has since been deleted or isn't visible to this user.
export function useLinkedTask(linkedTask: Task | null) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(linkedTask);
  const [linkedTaskId, setLinkedTaskId] = useQueryState(TASK_LINK_PARAM, parseAsString);

  // A link to a task that's since been deleted, or was never theirs, would otherwise land on
  // the plain list with no hint why nothing opened.
  useEffect(() => {
    if (!linkedTaskId || linkedTask) return;
    toast.error("That task is no longer available.");
    void setLinkedTaskId(null);
    // Mount-only: this reacts to the link the page was opened with, not later URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeDrawer() {
    setSelectedTask(null);
    // Otherwise a reload (or Back into this page) would reopen the drawer they just closed.
    if (linkedTaskId) void setLinkedTaskId(null);
  }

  return { selectedTask, setSelectedTask, closeDrawer };
}

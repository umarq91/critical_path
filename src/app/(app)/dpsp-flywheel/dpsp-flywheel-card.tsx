"use client";

import { taskOwners } from "@/app/(app)/tasks/task-parties";
import type { Task } from "@/data/tasks";

// One deliverable card in a Flywheel column — task name plus the same "season · owners" meta
// line the Timeline's bars use, since it's the same underlying task shown a different way.
export function DpspFlywheelCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const owners = taskOwners(task);
  const metaParts = [
    task.season?.season_code ?? task.season?.season_name,
    owners.length > 0 ? owners.map((owner) => owner.name).join(", ") : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-1 rounded-md border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/60"
    >
      <span className="text-sm leading-snug font-medium text-foreground uppercase">{task.task_name}</span>
      {metaParts.length > 0 ? (
        <span className="text-xs text-muted-foreground">{metaParts.join(" · ")}</span>
      ) : null}
    </button>
  );
}

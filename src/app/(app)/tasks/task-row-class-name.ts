import type { Task } from "@/data/tasks";

// Row tint for the task grids (Tasks and My Tasks). Critical wins over overdue: it's the stronger
// red plus a solid red stripe down the row's first cell, so a critical task stands out even
// among overdue ones. `isCritical` is passed in rather than read off the task, so a one-click
// toggle recolours the row before the save's refresh lands (use-critical-toggle.ts).
export function taskRowClassName(task: Task, isCritical: boolean): string | undefined {
  if (isCritical) return "bg-surface-critical [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-prio-high)]";
  if (task.status === "overdue") return "bg-surface-overdue";
  return undefined;
}

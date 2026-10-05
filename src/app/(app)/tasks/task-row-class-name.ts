import type { Task } from "@/data/tasks";

// Row tint for the task grids (Tasks and My Tasks). Critical wins over overdue: it's the stronger
// red plus a solid red stripe down the row's first cell, so a critical task stands out even
// among overdue ones.
export function taskRowClassName(task: Task): string | undefined {
  if (task.is_critical) return "bg-surface-critical [&>td:first-child]:shadow-[inset_3px_0_0_var(--color-prio-high)]";
  if (task.status === "overdue") return "bg-surface-overdue";
  return undefined;
}

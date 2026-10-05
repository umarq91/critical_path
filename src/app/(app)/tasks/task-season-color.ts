import { getVizColorForId } from "@/constants/chart-colors";
import type { Task } from "@/data/tasks";

// A task's colour on the Calendar and the Timeline: its season's own colour, so tasks read by
// season at a glance (client request; both used to colour by status). Every task requires a
// season (tasks.season_id is NOT NULL), so the fallback only covers an unresolved season join
// (e.g. a soft-deleted season), with the same deterministic id-to-palette pick other
// colourless entities use.
export function taskSeasonColor(task: Task): string {
  return task.season?.color ?? getVizColorForId(task.id);
}

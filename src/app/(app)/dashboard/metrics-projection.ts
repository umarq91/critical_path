import type { DonutChartSlice } from "@/components/charts/donut-chart";
import {
  TASK_GENDER_VIZ_COLORS,
  TASK_STATUS_VIZ_COLORS,
  VIZ_OTHER_COLOR,
  getVizColorForId,
} from "@/constants/chart-colors";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import type { TaskBreakdownGroup, TaskStatusCounts } from "@/data/dashboard";

/** What every dashboard card actually needs from a breakdown — `TaskBreakdownGroup` satisfies
 *  it, and so does a hand-built row like "one slice per task status". */
export type BreakdownGroup = Pick<TaskBreakdownGroup, "id" | "label" | "color" | "total" | "completed">;

// A donut stops being readable long before it stops being renderable. The tail folds into one
// neutral slice — every folded entity is still reachable through the card's filter dropdown,
// which is driven by the unfolded list.
const TOP_GROUP_COUNT = 6;
const OTHER_GROUP_ID = "other";

export function percentOf(part: number, whole: number) {
  return whole === 0 ? 0 : (part / whole) * 100;
}

export function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

export function formatShare(count: number, total: number) {
  return `${count.toLocaleString()} (${formatPercent(percentOf(count, total))})`;
}

export function totalOf(groups: BreakdownGroup[]) {
  return groups.reduce((sum, group) => sum + group.total, 0);
}

export function completionRateOf(groups: BreakdownGroup[]) {
  const completed = groups.reduce((sum, group) => sum + group.completed, 0);
  return percentOf(completed, totalOf(groups));
}

// Colour follows the entity, never its rank — a stored colour first, otherwise one derived
// from the entity's own id — so narrowing a card's filter never repaints the survivors.
export function groupColor(group: BreakdownGroup) {
  if (group.id === OTHER_GROUP_ID) return VIZ_OTHER_COLOR;
  return group.color ?? getVizColorForId(group.id);
}

export function scopeGroups<TGroup extends BreakdownGroup>(groups: TGroup[], selectedId: string | null) {
  if (!selectedId) return groups;
  return groups.filter((group) => group.id === selectedId);
}

export function foldTopGroups(groups: BreakdownGroup[], limit = TOP_GROUP_COUNT): BreakdownGroup[] {
  if (groups.length <= limit + 1) return groups;

  const rest = groups.slice(limit);
  return [
    ...groups.slice(0, limit),
    {
      id: OTHER_GROUP_ID,
      label: `Other (${rest.length})`,
      color: null,
      total: rest.reduce((sum, group) => sum + group.total, 0),
      completed: rest.reduce((sum, group) => sum + group.completed, 0),
    },
  ];
}

export function toDonutSlices(groups: BreakdownGroup[]): DonutChartSlice[] {
  return groups.map((group) => ({
    key: group.id,
    label: group.label,
    value: group.total,
    color: groupColor(group),
  }));
}

export function toFilterOptions(groups: BreakdownGroup[]) {
  return groups.map((group) => ({ value: group.id, label: group.label }));
}

// data/dashboard.ts stays label-free — it deals in enum values, not display strings. These two
// attach the display layer, in one place, for the cards AND the CSV export.

export function toStatusGroups(statusCounts: TaskStatusCounts): BreakdownGroup[] {
  return Object.entries(statusCounts).map(([status, count]) => ({
    id: status,
    label: TASK_STATUS_CONFIG[status]?.label ?? status,
    color: TASK_STATUS_VIZ_COLORS[status as keyof typeof TASK_STATUS_VIZ_COLORS] ?? null,
    total: count,
    // Only the "completed" slice contributes to a completion rate — but the Status card pins
    // its centre rate anyway, so this is here for consistency rather than for arithmetic.
    completed: status === "completed" ? count : 0,
  }));
}

export function toGenderGroups(groups: TaskBreakdownGroup[]): BreakdownGroup[] {
  return groups.map((group) => ({
    ...group,
    label: TASK_GENDER_CONFIG[group.id]?.label ?? group.label,
    color: TASK_GENDER_VIZ_COLORS[group.id as keyof typeof TASK_GENDER_VIZ_COLORS] ?? null,
  }));
}

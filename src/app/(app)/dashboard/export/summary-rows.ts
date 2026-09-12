import { taskStatusValues } from "@/app/(app)/tasks/schema";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { percentOf } from "@/app/(app)/dashboard/metrics-projection";
import type { ExportColumn } from "@/lib/export/types";
import type { DashboardMetrics, TaskStatusCounts } from "@/data/dashboard";

// The "Dashboard Summary" dataset: the same aggregate numbers the Status/Season/Brand/Gender
// donut cards and the Task Completion trend chart already render, reshaped into two flat
// tables. Unlike Task Records, these rows are NOT individually column-configurable — a
// breakdown row's six numbers are one indivisible unit (you wouldn't export "Completed" without
// "Total"), so the export dialog offers each TABLE as a single on/off toggle rather than a
// column checklist. This file only builds rows; ExportSheet is assembled where it's requested.

export interface BreakdownRow {
  /** "Status" | "Season" | "Brand" | "Gender" — what this row is a slice of. */
  dimension: string;
  label: string;
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
  /** 0–100, a NUMBER not a formatted string — see BREAKDOWN_COLUMNS' note on why. */
  completionRate: number;
  shareOfTotal: number;
}

export interface TrendRow {
  periodType: "Month" | "Week";
  /** The bucket's full label, e.g. "September 2026" or "Week of 07 Sep 2026" — the same string
   *  the Task Completion card's tooltip shows, not the axis's abbreviated tick. */
  period: string;
  total: number;
  completed: number;
  overdue: number;
  completionRate: number;
}

interface GroupLike {
  label: string;
  total: number;
  completed: number;
  statusCounts: TaskStatusCounts;
}

function toBreakdownRow(dimension: string, group: GroupLike, grandTotal: number): BreakdownRow {
  return {
    dimension,
    label: group.label,
    total: group.total,
    notStarted: group.statusCounts.not_started,
    inProgress: group.statusCounts.in_progress,
    completed: group.statusCounts.completed,
    overdue: group.statusCounts.overdue,
    completionRate: percentOf(group.completed, group.total),
    shareOfTotal: percentOf(group.total, grandTotal),
  };
}

// Always the WHOLE table's numbers, never scoped to the export's Task Records filters — see
// this module's note in things-to-know.md. getDashboardMetrics() itself is computed over every
// task with no filter, and this reshapes that same object, so "Dashboard Summary" in an export
// always means exactly what the live Dashboard page shows.
export function buildBreakdownRows(metrics: DashboardMetrics): BreakdownRow[] {
  const grandTotal = metrics.total;

  // A status row's own four sub-columns look redundant (its whole count sits in one of them) —
  // that's expected, not a bug: it keeps every row in this table the same shape, which is what
  // makes "Status" a dimension alongside Season/Brand/Gender rather than a special case.
  const statusRows = taskStatusValues.map((status) => {
    const total = metrics.statusCounts[status];
    const statusCounts: TaskStatusCounts = { not_started: 0, in_progress: 0, completed: 0, overdue: 0, [status]: total };
    return toBreakdownRow(
      "Status",
      { label: TASK_STATUS_CONFIG[status]?.label ?? status, total, completed: status === "completed" ? total : 0, statusCounts },
      grandTotal
    );
  });

  const seasonRows = metrics.bySeason.map((group) => toBreakdownRow("Season", group, grandTotal));
  const brandRows = metrics.byBrand.map((group) => toBreakdownRow("Brand", group, grandTotal));
  // toGenderGroups() in metrics-projection.ts strips statusCounts (BreakdownGroup only picks
  // id/label/color/total/completed) — read the raw metrics.byGender instead so the per-status
  // split survives, and relabel here the same way that helper does for the card.
  const genderRows = metrics.byGender.map((group) =>
    toBreakdownRow(
      "Gender",
      { label: TASK_GENDER_CONFIG[group.id]?.label ?? group.label, total: group.total, completed: group.completed, statusCounts: group.statusCounts },
      grandTotal
    )
  );

  return [...statusRows, ...seasonRows, ...brandRows, ...genderRows];
}

export function buildTrendRows(metrics: DashboardMetrics): TrendRow[] {
  const toRow = (periodType: TrendRow["periodType"]) => (bucket: DashboardMetrics["monthly"][number]): TrendRow => ({
    periodType,
    period: bucket.fullLabel,
    total: bucket.total,
    completed: bucket.completed,
    overdue: bucket.overdue,
    completionRate: percentOf(bucket.completed, bucket.total),
  });

  return [...metrics.monthly.map(toRow("Month")), ...metrics.weekly.map(toRow("Week"))];
}

// Fixed column sets — not user-configurable per-field, unlike TASK_RECORD_COLUMN_GROUPS (see
// this file's header note). `completionRate`/`shareOfTotal` are plain 0–100 NUMBERS, not
// pre-formatted "42.0%" strings: requirement is numbers stay numbers, so the percentage sign
// lives in the column label instead of inside the value.
export const BREAKDOWN_COLUMNS: ExportColumn<BreakdownRow>[] = [
  { key: "dimension", label: "Dimension", category: "summary", defaultSelected: true, dataType: "string", width: 12, getValue: (r) => r.dimension },
  { key: "label", label: "Label", category: "summary", defaultSelected: true, dataType: "string", width: 24, getValue: (r) => r.label },
  { key: "total", label: "Total Tasks", category: "summary", defaultSelected: true, dataType: "number", width: 12, getValue: (r) => r.total },
  { key: "not_started", label: "Not Started", category: "summary", defaultSelected: true, dataType: "number", width: 12, getValue: (r) => r.notStarted },
  { key: "in_progress", label: "In Progress", category: "summary", defaultSelected: true, dataType: "number", width: 12, getValue: (r) => r.inProgress },
  { key: "completed", label: "Completed", category: "summary", defaultSelected: true, dataType: "number", width: 12, getValue: (r) => r.completed },
  { key: "overdue", label: "Overdue", category: "summary", defaultSelected: true, dataType: "number", width: 12, getValue: (r) => r.overdue },
  { key: "completion_rate", label: "Completion Rate (%)", category: "summary", defaultSelected: true, dataType: "number", width: 16, getValue: (r) => Number(r.completionRate.toFixed(1)) },
  { key: "share_of_total", label: "Share of All Tasks (%)", category: "summary", defaultSelected: true, dataType: "number", width: 18, getValue: (r) => Number(r.shareOfTotal.toFixed(1)) },
];

export const TREND_COLUMNS: ExportColumn<TrendRow>[] = [
  { key: "period_type", label: "Period Type", category: "summary", defaultSelected: true, dataType: "string", width: 12, getValue: (r) => r.periodType },
  { key: "period", label: "Period", category: "summary", defaultSelected: true, dataType: "string", width: 24, getValue: (r) => r.period },
  { key: "total", label: "Total Tasks Due", category: "summary", defaultSelected: true, dataType: "number", width: 16, getValue: (r) => r.total },
  { key: "completed", label: "Completed", category: "summary", defaultSelected: true, dataType: "number", width: 12, getValue: (r) => r.completed },
  { key: "overdue", label: "Overdue", category: "summary", defaultSelected: true, dataType: "number", width: 12, getValue: (r) => r.overdue },
  { key: "completion_rate", label: "Completion Rate (%)", category: "summary", defaultSelected: true, dataType: "number", width: 16, getValue: (r) => Number(r.completionRate.toFixed(1)) },
];

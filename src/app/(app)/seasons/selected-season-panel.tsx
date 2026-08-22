import Link from "next/link";
import { Calendar } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { SEASON_STATUS_CONFIG } from "@/constants/season-status";
import type { Season } from "@/data/seasons";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

const DetailRow = ({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) => (
  <div className="flex items-center justify-between py-2 text-sm">
    <span className="flex items-center gap-2 text-muted-foreground">
      {Icon ? <Icon className="size-4" /> : null}
      {label}
    </span>
    <span className="font-medium text-foreground">{value}</span>
  </div>
);

export const SelectedSeasonPanel = ({ season }: { season: Season }) => {
  const ownerName = season.owner?.full_name ?? season.owner?.email ?? "Unassigned";
  // Tasks filters live in the DataTable's single JSON `filters` param (keyed by column id,
  // see data-table-search-params.ts); Calendar's season filter is its own flat `seasonId`
  // param (calendar-search-params.ts) — the two pages don't share a filter shape.
  const tasksHref = `/tasks?filters=${encodeURIComponent(JSON.stringify({ season_id: season.id }))}`;
  const calendarHref = `/calendar?seasonId=${season.id}`;

  return (
    <Card className="gap-3 px-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Selected Season</p>
        <StatusBadge value={season.status} config={SEASON_STATUS_CONFIG} />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">{season.season_code}</p>
        <p className="text-sm text-muted-foreground">{season.season_name}</p>
      </div>
      <div className="divide-y divide-border">
        <DetailRow label="Start Date" value={formatDate(season.start_date)} icon={Calendar} />
        <DetailRow label="End Date" value={formatDate(season.end_date)} icon={Calendar} />
        <DetailRow label="Owner" value={ownerName} />
        <DetailRow label="Last Updated" value={formatDate(season.updated_at)} />
      </div>
      {/* Brands/Tasks/Completed/In Progress/Not Started/Overdue/Owners rows from the mockup
          are dropped here — no real source until tasks (and a brand<->season link) exist. */}
      <div className="flex flex-col gap-2 pt-1">
        <Button variant="outline" nativeButton={false} render={<Link href={tasksHref} />}>
          View Tasks
        </Button>
        <Button nativeButton={false} render={<Link href={calendarHref} />}>
          View Calendar
        </Button>
      </div>
    </Card>
  );
};

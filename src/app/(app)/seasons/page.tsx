import { Calendar, Info } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SeasonPageActions } from "@/app/(app)/seasons/season-page-actions";
import { SeasonsBoard } from "@/app/(app)/seasons/seasons-board";
import { listSeasons, listSeasonSummary, listUpcomingSeasons } from "@/data/seasons";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";

const QUERY_STATE_OPTIONS = { defaultPageSize: 10, defaultSort: { id: "start_date", desc: false } };

export default async function SeasonsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryState = await loadDataTableSearchParams(searchParams, QUERY_STATE_OPTIONS);

  const [{ data: seasons, rowCount }, summary, upcomingSeasons, profile] = await Promise.all([
    listSeasons(queryState),
    listSeasonSummary(),
    listUpcomingSeasons(4),
    getCurrentProfile(),
  ]);
  const canManage = !!profile && can(profile.role, "admin.manage_lookups");

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Seasons"
        description="Manage and organise all active and upcoming seasons."
        action={<SeasonPageActions canCreateSeason={canManage} />}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Calendar}
            iconClassName="bg-primary-tint text-primary"
            label="Total Seasons"
            value={summary.total}
            description="All seasons in the system"
          />
          <StatCard
            icon={Calendar}
            iconClassName="bg-status-complete-soft text-status-complete-text"
            label="Active Seasons"
            value={summary.statusCounts.active}
            description="Currently active"
          />
          <StatCard
            icon={Calendar}
            iconClassName="bg-status-progress-soft text-status-progress-text"
            label="Upcoming Seasons"
            value={summary.statusCounts.upcoming}
            description="Starting in future"
          />
          <StatCard
            icon={Calendar}
            iconClassName="bg-prio-med-soft text-prio-med"
            label="Completed Seasons"
            value={summary.statusCounts.completed}
            description="Finished seasons"
          />
        </div>

        <SeasonsBoard
          seasons={seasons}
          rowCount={rowCount}
          canManage={canManage}
          ownerOptions={summary.owners}
          yearOptions={summary.years}
          upcomingSeasons={upcomingSeasons}
        />

        {/* Season Performance charts land here — reserved, not built yet. */}
        <div className="flex h-[340px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          Season Performance charts — coming soon
        </div>

        <Alert className="border-primary/20 bg-primary-tint">
          <Info className="text-primary" />
          <AlertDescription className="text-primary">
            Seasons help you organise tasks, track progress, and plan resources effectively.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

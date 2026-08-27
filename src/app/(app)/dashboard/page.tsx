import { CircleCheckBig, Clock, ListChecks, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { BreakdownDonutCard } from "@/app/(app)/dashboard/breakdown-donut-card";
import { CompletionRateCard } from "@/app/(app)/dashboard/completion-rate-card";
import { DashboardExportButton } from "@/app/(app)/dashboard/dashboard-export-button";
import { TaskCompletionCard } from "@/app/(app)/dashboard/task-completion-card";
import { TasksByBrandCard } from "@/app/(app)/dashboard/tasks-by-brand-card";
import {
  formatPercent,
  percentOf,
  toGenderGroups,
  toStatusGroups,
} from "@/app/(app)/dashboard/metrics-projection";
import { getDashboardMetrics } from "@/data/dashboard";
import { getCurrentProfile } from "@/data/profiles";

function firstName(fullName: string | null | undefined, email: string | undefined) {
  const name = fullName?.trim().split(/\s+/)[0];
  return name || email?.split("@")[0] || "there";
}

export default async function DashboardPage() {
  // One query for the whole page: a single aggregate pass over every task. Every tile and
  // chart below is a projection of it, so the numbers can't disagree with each other, and the
  // per-card filters narrow data already in the browser — nothing here costs a round trip per
  // chart or per filter click. getCurrentProfile() is React-cached and already resolved by
  // (app)/layout.tsx, so the name in the greeting adds nothing.
  const profile = await getCurrentProfile();
  const metrics = await getDashboardMetrics();

  const completionRate = percentOf(metrics.statusCounts.completed, metrics.total);
  const shareOfTotal = (count: number) => `${formatPercent(percentOf(count, metrics.total))} of total`;

  return (
    <div className="flex flex-col">
      <PageHeader
        title={`Welcome Back ${firstName(profile?.full_name, profile?.email)}!`}
        description="Here's what's happening with your tasks today."
        action={<DashboardExportButton metrics={metrics} />}
      />

      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={ListChecks}
            iconClassName="bg-primary-tint text-primary"
            label="Total Tasks"
            value={metrics.total.toLocaleString()}
            description="All tasks"
          />
          <StatCard
            icon={CircleCheckBig}
            iconClassName="bg-status-complete-soft text-status-complete-text"
            label="Completed"
            value={metrics.statusCounts.completed.toLocaleString()}
            description={shareOfTotal(metrics.statusCounts.completed)}
          />
          <StatCard
            icon={Clock}
            iconClassName="bg-status-progress-soft text-status-progress-text"
            label="In Progress"
            value={metrics.statusCounts.in_progress.toLocaleString()}
            description={shareOfTotal(metrics.statusCounts.in_progress)}
          />
          <StatCard
            icon={TriangleAlert}
            iconClassName="bg-status-overdue-soft text-status-overdue-text"
            label="Overdue"
            value={metrics.statusCounts.overdue.toLocaleString()}
            description={shareOfTotal(metrics.statusCounts.overdue)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BreakdownDonutCard
            title="Tasks by Season"
            description="Every task by the season it belongs to"
            allLabel="All Seasons"
            groups={metrics.bySeason}
          />
          <BreakdownDonutCard
            title="Task Status Overview"
            description="Every task by its current status"
            allLabel="All Status"
            groups={toStatusGroups(metrics.statusCounts)}
            centerRate={completionRate}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <CompletionRateCard completed={metrics.statusCounts.completed} total={metrics.total} />
          <TasksByBrandCard groups={metrics.byBrand} className="lg:col-span-2" />
          <BreakdownDonutCard
            title="Tasks by Gender"
            description="Range split across men, women and unisex"
            allLabel="All Gender"
            groups={toGenderGroups(metrics.byGender)}
          />
        </div>

        <TaskCompletionCard monthly={metrics.monthly} weekly={metrics.weekly} />
      </div>
    </div>
  );
}

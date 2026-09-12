import { PageHeader } from "@/components/shared/page-header";
import { CriticalPathTabs } from "@/components/shared/critical-path-tabs";
import { DpspFlywheelWorkspace } from "@/app/(app)/dpsp-flywheel/dpsp-flywheel-workspace";
import { loadDpspFlywheelSearchParams } from "@/app/(app)/dpsp-flywheel/dpsp-flywheel-search-params";
import { listTasksForFlywheel } from "@/data/tasks";
import { listSeasonOptions } from "@/data/seasons";
import { listDepartmentOptions } from "@/data/departments";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { partyKey } from "@/lib/party";

export default async function DpspFlywheelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { seasonId, department, q, hideDone } = await loadDpspFlywheelSearchParams(searchParams);
  const filters: Record<string, string> = { season_id: seasonId, owner: department, search: q };
  if (hideDone) filters.hide_done = "true";

  const [tasks, seasons, departments, profile] = await Promise.all([
    listTasksForFlywheel(filters),
    listSeasonOptions(),
    listDepartmentOptions(),
    getCurrentProfile(),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="DPSP Flywheel"
        description="Deliverables grouped by Demand, Product, Sales and Profit — the client's recurring critical-path loop."
      />
      <CriticalPathTabs active="dpsp-flywheel" />
      <div className="flex flex-col gap-4 px-6 pt-4 pb-6">
        <DpspFlywheelWorkspace
          tasks={tasks}
          canAssignPeople={!!profile && can(profile.role, "task.assign")}
          seasonOptions={seasons.map((season) => ({ value: season.id, label: season.season_name }))}
          departmentOptions={departments.map((dept) => ({
            value: partyKey({ kind: "department", id: dept.id }),
            label: dept.name,
          }))}
        />
      </div>
    </div>
  );
}

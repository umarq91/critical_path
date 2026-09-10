import { PageHeader } from "@/components/shared/page-header";
import { TaskPageActions } from "@/app/(app)/tasks/task-page-actions";
import { TasksBoard } from "@/app/(app)/tasks/tasks-board";
import { listTasks } from "@/data/tasks";
import { listSeasonOptions } from "@/data/seasons";
import { listBrandOptions } from "@/data/brands";
import { listKeyStageOptions } from "@/data/key-stages";
import { getCurrentProfile } from "@/data/profiles";
import { listPartyOptions } from "@/data/parties";
import { can } from "@/lib/permissions";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";
import { TASKS_QUERY_STATE } from "@/app/(app)/tasks/query-state";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryState = await loadDataTableSearchParams(searchParams, TASKS_QUERY_STATE);

  const [{ data: tasks, rowCount }, seasons, brands, keyStages, ownerOptions, profile] = await Promise.all([
    listTasks(queryState),
    listSeasonOptions(),
    listBrandOptions(),
    listKeyStageOptions(),
    listPartyOptions(),
    getCurrentProfile(),
  ]);

  const canCreateTask = !!profile && can(profile.role, "task.create");
  const canManage = !!profile && can(profile.role, "task.update");
  const canDelete = !!profile && can(profile.role, "task.delete");
  const canAssignPeople = !!profile && can(profile.role, "task.assign");

  const seasonOptions = seasons.map((season) => ({ value: season.id, label: season.season_name }));
  const brandOptions = brands.map((brand) => ({ value: brand.id, label: brand.brand_name }));
  const keyStageOptions = keyStages.map((keyStage) => ({ value: keyStage.id, label: keyStage.name }));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Task Management"
        description="Manage and track all tasks across seasons, brands and teams"
        action={
          <TaskPageActions
            canCreateTask={canCreateTask}
            seasonOptions={seasonOptions}
            brandOptions={brandOptions}
            keyStageOptions={keyStageOptions}
          />
        }
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <TasksBoard
          tasks={tasks}
          rowCount={rowCount}
          canManage={canManage}
          canDelete={canDelete}
          canAssignPeople={canAssignPeople}
          seasonOptions={seasonOptions}
          brandOptions={brandOptions}
          keyStageOptions={keyStageOptions}
          ownerOptions={ownerOptions}
        />
      </div>
    </div>
  );
}

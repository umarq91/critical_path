import { PageHeader } from "@/components/shared/page-header";
import { MyTasksBoard } from "@/app/(app)/my-tasks/my-tasks-board";
import { z } from "zod";
import { getTaskById, listTasksForProfile } from "@/data/tasks";
import { listSeasonOptions } from "@/data/seasons";
import { listBrandOptions } from "@/data/brands";
import { listKeyStageOptions } from "@/data/key-stages";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";
import { TASK_LINK_PARAM } from "@/constants/routes";

const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "due_date", desc: false } };

export default async function MyTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryState = await loadDataTableSearchParams(searchParams, QUERY_STATE_OPTIONS);
  const profile = await getCurrentProfile();
  const linkedTaskId = z.string().uuid().safeParse((await searchParams)[TASK_LINK_PARAM]);

  // No signed-in profile shouldn't happen here — (app)/layout.tsx already guards auth for the
  // whole authenticated shell — but without one there's no "me" to scope this page to.
  const [{ data: tasks, rowCount }, seasons, brands, keyStages, linkedTask] = await Promise.all([
    profile ? listTasksForProfile(profile.id, queryState) : Promise.resolve({ data: [], rowCount: 0 }),
    listSeasonOptions(),
    listBrandOptions(),
    listKeyStageOptions(),
    linkedTaskId.success ? getTaskById(linkedTaskId.data) : Promise.resolve(null),
  ]);

  const canManage = !!profile && can(profile.role, "task.update");
  const canDelete = !!profile && can(profile.role, "task.delete");
  const canAssignPeople = !!profile && can(profile.role, "task.assign");

  const seasonOptions = seasons.map((season) => ({ value: season.id, label: season.season_name }));
  const brandOptions = brands.map((brand) => ({ value: brand.id, label: brand.brand_name }));
  const keyStageOptions = keyStages.map((keyStage) => ({ value: keyStage.id, label: keyStage.name }));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="My Tasks"
        description="Tasks you created, own, or are involved in — nearest due date first."
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <MyTasksBoard
          tasks={tasks}
          rowCount={rowCount}
          canManage={canManage}
          canDelete={canDelete}
          canAssignPeople={canAssignPeople}
          seasonOptions={seasonOptions}
          brandOptions={brandOptions}
          keyStageOptions={keyStageOptions}
          linkedTask={linkedTask}
        />
      </div>
    </div>
  );
}

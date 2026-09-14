import { PageHeader } from "@/components/shared/page-header";
import { TrashBoard } from "@/app/(app)/tasks/trash/trash-board";
import { listDeletedTasks } from "@/data/tasks";
import { listSeasonOptions } from "@/data/seasons";
import { listBrandOptions } from "@/data/brands";
import { requirePageAccess } from "@/lib/require-page-access";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";

const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "deleted_at", desc: true } };

export default async function TasksTrashPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Trash is where a removed task's data still lives, so it gets the same admin-only gate as
  // deleting one — task.delete, not task.view: seeing what's in the trash is part of the
  // delete/restore capability, not a wider read grant.
  await requirePageAccess("task.delete");
  const queryState = await loadDataTableSearchParams(searchParams, QUERY_STATE_OPTIONS);

  const [{ data: tasks, rowCount }, seasons, brands] = await Promise.all([
    listDeletedTasks(queryState),
    listSeasonOptions(),
    listBrandOptions(),
  ]);

  const seasonOptions = seasons.map((season) => ({ value: season.id, label: season.season_name }));
  const brandOptions = brands.map((brand) => ({ value: brand.id, label: brand.brand_name }));

  return (
    <div className="flex flex-col">
      <PageHeader title="Trash" description="Tasks deleted from Task Management. Restore one at any time — nothing here is removed permanently." />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <TrashBoard
          tasks={tasks}
          rowCount={rowCount}
          canRestore
          seasonOptions={seasonOptions}
          brandOptions={brandOptions}
        />
      </div>
    </div>
  );
}

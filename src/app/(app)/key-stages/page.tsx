import { PageHeader } from "@/components/shared/page-header";
import { KeyStagePageActions } from "@/app/(app)/key-stages/key-stage-page-actions";
import { KeyStagesBoard } from "@/app/(app)/key-stages/key-stages-board";
import { listKeyStages } from "@/data/key-stages";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";

const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "name", desc: false } };

export default async function KeyStagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryState = await loadDataTableSearchParams(searchParams, QUERY_STATE_OPTIONS);

  const [{ data: keyStages, rowCount }, profile] = await Promise.all([
    listKeyStages(queryState),
    getCurrentProfile(),
  ]);

  const canManage = !!profile && can(profile.role, "admin.manage_lookups");

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Key Stages"
        description="Manage the key stages tasks can be grouped under."
        action={<KeyStagePageActions canCreateKeyStage={canManage} />}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <KeyStagesBoard keyStages={keyStages} rowCount={rowCount} canManage={canManage} canDelete={canManage} />
      </div>
    </div>
  );
}

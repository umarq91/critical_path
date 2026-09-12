import { PageHeader } from "@/components/shared/page-header";
import { KeyStagePageActions } from "@/app/(app)/key-stages/key-stage-page-actions";
import { KeyStagesBoard } from "@/app/(app)/key-stages/key-stages-board";
import { listKeyStages } from "@/data/key-stages";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { requirePageAccess } from "@/lib/require-page-access";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";
import { KEY_STAGES_QUERY_STATE } from "@/app/(app)/key-stages/query-state";

export default async function KeyStagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // External users have no business on an organisation-wide lookup list; the sidebar
  // hides the link, and this is what makes typing the URL equally ineffective.
  await requirePageAccess("lookups.view");
  const queryState = await loadDataTableSearchParams(searchParams, KEY_STAGES_QUERY_STATE);

  const [{ data: keyStages, rowCount }, profile] = await Promise.all([
    listKeyStages(queryState),
    getCurrentProfile(),
  ]);

  const canManage = !!profile && can(profile.role, "admin.manage_lookups");
  const canExport = !!profile && can(profile.role, "dashboard.export_reports");

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Key Stages"
        description="Manage the key stages tasks can be grouped under."
        action={<KeyStagePageActions canCreateKeyStage={canManage} canExport={canExport} rowCount={rowCount} />}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <KeyStagesBoard keyStages={keyStages} rowCount={rowCount} canManage={canManage} canDelete={canManage} />
      </div>
    </div>
  );
}

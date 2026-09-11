import { PageHeader } from "@/components/shared/page-header";
import { ExternalLinkPageActions } from "@/app/(app)/external-links/external-link-page-actions";
import { ExternalLinksBoard } from "@/app/(app)/external-links/external-links-board";
import { EXTERNAL_LINKS_QUERY_STATE } from "@/app/(app)/external-links/query-state";
import { listExternalLinks } from "@/data/external-links";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { requirePageAccess } from "@/lib/require-page-access";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";

export default async function ExternalLinksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Internal staff only — the sidebar hides the link for external users, and this is what
  // makes typing the URL equally ineffective. RLS on external_links says the same thing.
  await requirePageAccess("lookups.view");
  const queryState = await loadDataTableSearchParams(searchParams, EXTERNAL_LINKS_QUERY_STATE);

  const [{ data: links, rowCount }, profile] = await Promise.all([
    listExternalLinks(queryState),
    getCurrentProfile(),
  ]);

  // Admin-only, per the client: everyone else reads the list and follows the links.
  const canManage = !!profile && can(profile.role, "admin.manage_lookups");

  return (
    <div className="flex flex-col">
      <PageHeader
        title="External Links"
        description="Shared resources and useful links for the team."
        action={<ExternalLinkPageActions canManage={canManage} />}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <ExternalLinksBoard links={links} rowCount={rowCount} canManage={canManage} />
      </div>
    </div>
  );
}

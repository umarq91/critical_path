import { PageHeader } from "@/components/shared/page-header";
import { BrandPageActions } from "@/app/(app)/brands/brand-page-actions";
import { BrandsBoard } from "@/app/(app)/brands/brands-board";
import { listBrands } from "@/data/brands";
import { listSeasonOptions } from "@/data/seasons";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { requirePageAccess } from "@/lib/require-page-access";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";
import { BRANDS_QUERY_STATE } from "@/app/(app)/brands/query-state";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // External users have no business on an organisation-wide lookup list; the sidebar
  // hides the link, and this is what makes typing the URL equally ineffective.
  await requirePageAccess("brand.view");
  const queryState = await loadDataTableSearchParams(searchParams, BRANDS_QUERY_STATE);

  const [{ data: brands, rowCount }, seasons, profile] = await Promise.all([
    listBrands(queryState),
    listSeasonOptions(),
    getCurrentProfile(),
  ]);
  const canManage = !!profile && can(profile.role, "brand.manage");
  const canDelete = !!profile && can(profile.role, "brand.delete");
  const canExport = !!profile && can(profile.role, "dashboard.export_reports");
  const seasonOptions = seasons.map((season) => ({ value: season.id, label: season.season_name }));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Brands"
        description="Manage the brands tasks and seasons are organised under."
        action={
          <BrandPageActions canCreateBrand={canManage} canExport={canExport} rowCount={rowCount} seasonOptions={seasons} />
        }
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <BrandsBoard
          brands={brands}
          rowCount={rowCount}
          canManage={canManage}
          canDelete={canDelete}
          seasonOptions={seasonOptions}
        />
      </div>
    </div>
  );
}

import { Tag } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { BrandPageActions } from "@/app/(app)/brands/brand-page-actions";
import { BrandsBoard } from "@/app/(app)/brands/brands-board";
import { listBrands, listBrandSummary } from "@/data/brands";
import { listSeasonOptions } from "@/data/seasons";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";

const QUERY_STATE_OPTIONS = { defaultPageSize: 10, defaultSort: { id: "brand_name", desc: false } };

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryState = await loadDataTableSearchParams(searchParams, QUERY_STATE_OPTIONS);

  const [{ data: brands, rowCount }, summary, seasons, profile] = await Promise.all([
    listBrands(queryState),
    listBrandSummary(),
    listSeasonOptions(),
    getCurrentProfile(),
  ]);
  const canManage = !!profile && can(profile.role, "brand.manage");
  const canDelete = !!profile && can(profile.role, "brand.delete");
  const seasonOptions = seasons.map((season) => ({ value: season.id, label: season.season_name }));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Brands"
        description="Manage the brands tasks and seasons are organised under."
        action={<BrandPageActions canCreateBrand={canManage} seasonOptions={seasons} />}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Tag}
            iconClassName="bg-primary-tint text-primary"
            label="Total Brands"
            value={summary.total}
            description="All brands in the system"
          />
          <StatCard
            icon={Tag}
            iconClassName="bg-status-complete-soft text-status-complete-text"
            label="Active Brands"
            value={summary.statusCounts.active}
            description="Currently active"
          />
          <StatCard
            icon={Tag}
            iconClassName="bg-status-overdue-soft text-status-overdue-text"
            label="Inactive Brands"
            value={summary.statusCounts.inactive}
            description="Not currently active"
          />
          <StatCard
            icon={Tag}
            iconClassName="bg-prio-med-soft text-prio-med"
            label="Added This Year"
            value={summary.addedThisYear}
            description="New brands this year"
          />
        </div>

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

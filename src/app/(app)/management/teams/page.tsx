import { Building2, UsersRound, UserMinus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DepartmentPageActions } from "@/app/(app)/management/teams/department-page-actions";
import { DepartmentsBoard } from "@/app/(app)/management/teams/departments-board";
import { listDepartments, getDepartmentSummary } from "@/data/departments";
import { requirePageAccess } from "@/lib/require-page-access";
import { can } from "@/lib/permissions";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";

const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "name", desc: false } };

export default async function ManagementTeamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Moved here from the top-level /departments route, so it's admin-only now rather than
  // visible to every internal role — it sits in Management alongside Users, and editing team
  // membership means editing user records.
  const profile = await requirePageAccess("admin.manage_lookups");
  const queryState = await loadDataTableSearchParams(searchParams, QUERY_STATE_OPTIONS);

  const [{ data: departments, rowCount }, summary] = await Promise.all([
    listDepartments(queryState),
    getDepartmentSummary(),
  ]);

  const canManage = can(profile.role, "admin.manage_lookups");
  const canManageMembers = can(profile.role, "admin.manage_users");

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Teams / Departments"
        description="Departments are both a grouping for users and an assignable party on a task. Manage who belongs to each one here."
        action={<DepartmentPageActions canCreateDepartment={canManage} />}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={Building2}
            iconClassName="bg-primary-tint text-primary"
            label="Departments"
            value={summary.total}
            description="Teams tasks can be owned by"
          />
          <StatCard
            icon={UsersRound}
            iconClassName="bg-status-complete-soft text-status-complete-text"
            label="With Members"
            value={summary.withMembers}
            description="The rest are external — Vendor, Supplier"
          />
          <StatCard
            icon={UserMinus}
            iconClassName="bg-prio-med-soft text-prio-med"
            label="Unassigned Users"
            value={summary.unassignedUsers}
            description="Not in any department yet"
          />
        </div>
        <DepartmentsBoard
          departments={departments}
          rowCount={rowCount}
          canManage={canManage}
          canDelete={canManage}
          canManageMembers={canManageMembers}
        />
      </div>
    </div>
  );
}

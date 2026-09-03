import { Users, Building2, UserPlus, UserX } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { UserPageActions } from "@/app/(app)/management/users/user-page-actions";
import { UsersBoard } from "@/app/(app)/management/users/users-board";
import { listUsers, getUserSummary } from "@/data/users";
import { listDepartmentOptions } from "@/data/departments";
import { requirePageAccess } from "@/lib/require-page-access";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";

const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "full_name", desc: false } };

export default async function ManagementUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await requirePageAccess("admin.manage_users");
  const queryState = await loadDataTableSearchParams(searchParams, QUERY_STATE_OPTIONS);

  const [{ data: users, rowCount }, summary, departments] = await Promise.all([
    listUsers(queryState),
    getUserSummary(),
    listDepartmentOptions(),
  ]);

  const departmentOptions = departments.map((department) => ({ value: department.id, label: department.name }));

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Users"
        description="Google Workspace staff appear here on first sign-in. External users are created here and sign in with a password."
        action={<UserPageActions departmentOptions={departmentOptions} />}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            iconClassName="bg-primary-tint text-primary"
            label="Total Users"
            value={summary.total}
            description="Every account on the platform"
          />
          <StatCard
            icon={Building2}
            iconClassName="bg-status-progress-soft text-status-progress-text"
            label="Workspace Users"
            value={summary.workspace}
            description="Sign in with Google"
          />
          <StatCard
            icon={UserPlus}
            iconClassName="bg-prio-med-soft text-prio-med"
            label="External Users"
            value={summary.external}
            description="Sign in with a password"
          />
          <StatCard
            icon={UserX}
            iconClassName="bg-status-overdue-soft text-status-overdue-text"
            label="Deactivated"
            value={summary.inactive}
            description="No access until reactivated"
          />
        </div>
        <UsersBoard
          users={users}
          rowCount={rowCount}
          currentUserId={profile.id}
          departmentOptions={departmentOptions}
        />
      </div>
    </div>
  );
}

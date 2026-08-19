import { PageHeader } from "@/components/shared/page-header";
import { DepartmentPageActions } from "@/app/(app)/departments/department-page-actions";
import { DepartmentsBoard } from "@/app/(app)/departments/departments-board";
import { listDepartments } from "@/data/departments";
import { getCurrentProfile } from "@/data/profiles";
import { can } from "@/lib/permissions";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";

const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "name", desc: false } };

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryState = await loadDataTableSearchParams(searchParams, QUERY_STATE_OPTIONS);

  const [{ data: departments, rowCount }, profile] = await Promise.all([
    listDepartments(queryState),
    getCurrentProfile(),
  ]);

  const canManage = !!profile && can(profile.role, "admin.manage_lookups");

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Departments"
        description="Manage the departments tasks and users can be grouped under."
        action={<DepartmentPageActions canCreateDepartment={canManage} />}
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <DepartmentsBoard departments={departments} rowCount={rowCount} canManage={canManage} canDelete={canManage} />
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { createUserColumns } from "@/app/(app)/management/users/columns";
import { ACCOUNT_TYPE_CONFIG, USER_ROLE_CONFIG, USER_STATUS_CONFIG } from "@/constants/user-account";
import type { ManagedUser } from "@/data/users";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface UsersBoardProps {
  users: ManagedUser[];
  rowCount: number;
  currentUserId: string;
  departmentOptions: DataTableFilterOption[];
}

const toFilterOptions = (config: Record<string, { label: string }>) =>
  Object.entries(config).map(([value, { label }]) => ({ value, label }));

export const UsersBoard = ({ users, rowCount, currentUserId, departmentOptions }: UsersBoardProps) => {
  const queryState = useDataTableQueryState({ defaultPageSize: 15, defaultSort: { id: "full_name", desc: false } });

  const userColumns = useMemo(
    () => createUserColumns({ currentUserId, departmentOptions }),
    [currentUserId, departmentOptions]
  );

  return (
    <DataTable
      columns={userColumns}
      data={users}
      queryState={queryState}
      rowCount={rowCount}
      enableColumnFilterRow={false}
      paginationLabel="users"
      toolbar={{
        filters: [
          // Filters on the derived account type rather than listing four roles twice — see
          // listUsers(), which maps this onto role at the query level.
          { columnId: "accountType", title: "Account Type", placeholder: "Account Type", options: toFilterOptions(ACCOUNT_TYPE_CONFIG) },
          { columnId: "role", title: "Role", placeholder: "Role", options: toFilterOptions(USER_ROLE_CONFIG) },
          { columnId: "status", title: "Status", placeholder: "Status", options: toFilterOptions(USER_STATUS_CONFIG) },
        ],
        sortOptions: [
          { columnId: "full_name", desc: false, label: "Name (A-Z)" },
          { columnId: "full_name", desc: true, label: "Name (Z-A)" },
          { columnId: "created_at", desc: true, label: "Added On (Newest)" },
          { columnId: "created_at", desc: false, label: "Added On (Oldest)" },
        ],
        searchColumnId: "full_name",
        searchPlaceholder: "Search by name or email...",
      }}
    />
  );
};

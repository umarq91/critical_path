"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserRowActions } from "@/app/(app)/management/users/user-row-actions";
import { accountTypeOf } from "@/app/(app)/management/users/schema";
import { ACCOUNT_TYPE_CONFIG, USER_ROLE_CONFIG, USER_STATUS_CONFIG } from "@/constants/user-account";
import type { ManagedUser } from "@/data/users";
import { formatDate } from "@/lib/dates";

const columnHelper = createColumnHelper<typeof dataTableFeatures, ManagedUser>();

interface CreateUserColumnsOptions {
  currentUserId: string;
  departmentOptions: { value: string; label: string }[];
}

export function createUserColumns({ currentUserId, departmentOptions }: CreateUserColumnsOptions) {
  return [
    columnHelper.accessor("full_name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      meta: { label: "Name", width: "lg" },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-body-strong text-foreground">{row.original.full_name ?? "—"}</span>
          <span className="text-sm text-muted-foreground">{row.original.email}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: "account_type",
      header: "Account Type",
      meta: { label: "Account Type", width: "sm" },
      cell: ({ row }) => <StatusBadge value={accountTypeOf(row.original.role)} config={ACCOUNT_TYPE_CONFIG} />,
    }),
    columnHelper.accessor("role", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
      meta: { label: "Role", width: "sm" },
      cell: ({ getValue }) => <StatusBadge value={getValue()} config={USER_ROLE_CONFIG} />,
    }),
    columnHelper.display({
      id: "department",
      header: "Department",
      meta: { label: "Department", width: "md" },
      cell: ({ row }) => row.original.department?.name ?? "—",
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      meta: { label: "Status", width: "sm" },
      cell: ({ getValue }) => <StatusBadge value={getValue()} config={USER_STATUS_CONFIG} />,
    }),
    columnHelper.accessor("created_at", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Added On" />,
      meta: { label: "Added On", width: "sm" },
      sortFn: "datetime",
      cell: ({ getValue }) => formatDate(getValue()),
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { label: "Actions", sticky: "right", width: "xs" },
      cell: ({ row }) => (
        <UserRowActions
          user={row.original}
          departmentOptions={departmentOptions}
          isCurrentUser={row.original.id === currentUserId}
        />
      ),
    }),
  ];
}

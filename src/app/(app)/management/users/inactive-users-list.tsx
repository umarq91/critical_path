"use client";

import { UserX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserRowActions } from "@/app/(app)/management/users/user-row-actions";
import { accountTypeOf } from "@/app/(app)/management/users/schema";
import { ACCOUNT_TYPE_CONFIG } from "@/constants/user-account";
import type { ManagedUser } from "@/data/users";
import type { DataTableFilterOption } from "@/components/data-table/table-features";

interface InactiveUsersListProps {
  users: ManagedUser[];
  departmentOptions: DataTableFilterOption[];
  currentUserId: string;
}

export const InactiveUsersList = ({ users, departmentOptions, currentUserId }: InactiveUsersListProps) => {
  if (users.length === 0) {
    return <EmptyState icon={UserX} title="No inactive users" description="Deactivated accounts will appear here." />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-md border">
      {users.map((user) => (
        <li key={user.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body-strong text-foreground">{user.full_name ?? user.email}</span>
            <span className="truncate text-sm text-muted-foreground">
              {user.email}
              {user.department ? ` · ${user.department.name}` : ""}
            </span>
          </div>
          <StatusBadge value={accountTypeOf(user.role)} config={ACCOUNT_TYPE_CONFIG} />
          <UserRowActions
            user={user}
            departmentOptions={departmentOptions}
            isCurrentUser={user.id === currentUserId}
          />
        </li>
      ))}
    </ul>
  );
};

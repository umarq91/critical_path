"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { KeyRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { StatusBadge } from "@/components/shared/status-badge";
import { RevokeKeyButton } from "@/app/(app)/management/integrations/revoke-key-button";
import { API_KEY_STATUS_CONFIG } from "@/constants/api-key-status";
import { getVizColorForId } from "@/constants/chart-colors";
import { formatDateTime } from "@/lib/dates";
import { initials } from "@/lib/utils";
import type { ApiKey } from "@/data/api-keys";

const columnHelper = createColumnHelper<typeof dataTableFeatures, ApiKey>();

function PersonCell({ profile }: { profile: ApiKey["created_by_profile"] }) {
  if (!profile) return <span className="text-muted-foreground">—</span>;
  const name = profile.full_name ?? profile.email;
  return (
    <div className="flex items-center gap-2.5">
      <Avatar size="sm" className="shrink-0">
        <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="text-white" style={{ backgroundColor: getVizColorForId(profile.id) }}>
          {initials(name, profile.email)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-body-strong text-foreground">{name}</span>
    </div>
  );
}

// Read-only, like trash/columns.tsx — nothing on this row is inline-editable, only revocable.
export function createApiKeyColumns() {
  return [
    columnHelper.accessor("name", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      meta: { label: "Name", width: "lg" },
    }),
    // key_prefix only — the hash never leaves the server, and the raw key was already shown
    // once at creation and is gone. The dots are purely a visual cue that more characters
    // existed; they don't stand for anything recoverable.
    columnHelper.accessor("key_prefix", {
      header: "Key",
      meta: { label: "Key", width: "md" },
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="flex items-center gap-1.5 font-mono text-sm text-muted-foreground">
          <KeyRound className="size-3.5 shrink-0" />
          {getValue()}••••••••••••••••••••
        </span>
      ),
    }),
    columnHelper.accessor("status", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      meta: { label: "Status", width: "xs" },
      enableSorting: false,
      cell: ({ getValue }) => <StatusBadge value={getValue()} config={API_KEY_STATUS_CONFIG} />,
    }),
    columnHelper.display({
      id: "created_by",
      header: "Created By",
      meta: { label: "Created By", width: "md" },
      cell: ({ row }) => <PersonCell profile={row.original.created_by_profile} />,
    }),
    columnHelper.accessor("created_at", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Created At" />,
      meta: { label: "Created At", width: "sm" },
      sortFn: "datetime",
      cell: ({ getValue }) => <span className="whitespace-nowrap text-body">{formatDateTime(getValue())}</span>,
    }),
    columnHelper.accessor("last_used_at", {
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last Used" />,
      meta: { label: "Last Used", width: "sm" },
      sortFn: "datetime",
      cell: ({ getValue }) => {
        const value = getValue();
        return <span className="whitespace-nowrap text-body">{value ? formatDateTime(value) : "Never"}</span>;
      },
    }),
    columnHelper.display({
      id: "actions",
      header: "Actions",
      meta: { label: "Actions", sticky: "right", width: "xs" },
      cell: ({ row }) => {
        if (row.original.status !== "active") return null;
        return (
          <div onClick={(event) => event.stopPropagation()}>
            <RevokeKeyButton keyId={row.original.id} keyName={row.original.name} />
          </div>
        );
      },
    }),
  ];
}

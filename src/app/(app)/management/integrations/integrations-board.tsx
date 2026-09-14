"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTableQueryState } from "@/components/data-table/use-data-table-query-state";
import { EmptyState } from "@/components/shared/empty-state";
import { createApiKeyColumns } from "@/app/(app)/management/integrations/columns";
import type { ApiKey } from "@/data/api-keys";

interface IntegrationsBoardProps {
  apiKeys: ApiKey[];
  rowCount: number;
}

const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "created_at", desc: true } };

export const IntegrationsBoard = ({ apiKeys, rowCount }: IntegrationsBoardProps) => {
  const queryState = useDataTableQueryState(QUERY_STATE_OPTIONS);
  const columns = useMemo(() => createApiKeyColumns(), []);

  return (
    <DataTable
      columns={columns}
      data={apiKeys}
      queryState={queryState}
      rowCount={rowCount}
      enableColumnFilterRow={false}
      paginationLabel="keys"
      emptyState={
        <EmptyState
          title="No API keys yet"
          description="Create a key to authenticate the integration API for an external system."
        />
      }
    />
  );
};

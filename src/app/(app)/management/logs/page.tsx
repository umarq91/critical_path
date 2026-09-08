import { History, PlusCircle, PencilLine, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { LogsBoard } from "@/app/(app)/management/logs/logs-board";
import { listAuditEvents, getAuditLogSummary, listAuditActorOptions } from "@/data/audit-log";
import { requirePageAccess } from "@/lib/require-page-access";
import { loadDataTableSearchParams } from "@/components/data-table/data-table-search-params";

const QUERY_STATE_OPTIONS = { defaultPageSize: 15, defaultSort: { id: "created_at", desc: true } };

export default async function ManagementLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAccess("admin.view_audit_log");
  const queryState = await loadDataTableSearchParams(searchParams, QUERY_STATE_OPTIONS);

  const [{ data: events, rowCount }, summary, actorOptions] = await Promise.all([
    listAuditEvents(queryState),
    getAuditLogSummary(),
    listAuditActorOptions(),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Logs"
        description="Who created, edited, reassigned or deleted a task, and when. Entries are recorded automatically and can't be edited or removed."
      />
      <div className="flex flex-col gap-4 px-6 pb-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={History}
            iconClassName="bg-primary-tint text-primary"
            label="Total Events"
            value={summary.total}
            description="Every action recorded"
          />
          <StatCard
            icon={PlusCircle}
            iconClassName="bg-status-complete-soft text-status-complete-text"
            label="Tasks Created"
            value={summary.created}
            description="Across every season"
          />
          <StatCard
            icon={PencilLine}
            iconClassName="bg-status-progress-soft text-status-progress-text"
            label="Tasks Updated"
            value={summary.updated}
            description="Field-level edits"
          />
          <StatCard
            icon={Trash2}
            iconClassName="bg-status-overdue-soft text-status-overdue-text"
            label="Tasks Deleted"
            value={summary.deleted}
            description="Soft-deleted, still recoverable"
          />
        </div>
        <LogsBoard events={events} rowCount={rowCount} actorOptions={actorOptions} />
      </div>
    </div>
  );
}

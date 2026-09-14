// The in-app version of docs/databricks-integration-api-spec.md — every endpoint the spec
// describes, transcribed the same way that file was (see its own header), so a Databricks/Kong
// integrator has a reference inside the product instead of needing repo access. Single source
// of truth is still the markdown file; if the spec changes, update both together.
//
// `status: "live"` means a real route exists at src/app/integration/v1/<path>/route.ts and
// returns exactly this shape (deviations noted per-endpoint, e.g. /seasons' `version`).
// `status: "planned"` means this is still just the target shape — see things-to-know.md's
// Integrations section before building one; most planned `tasks` fields have no backing column
// yet.

export interface EndpointParam {
  name: string;
  description: string;
}

export interface EndpointDoc {
  method: "GET";
  path: string;
  status: "live" | "planned";
  purpose: string;
  pathParams?: EndpointParam[];
  queryParams?: EndpointParam[];
  exampleResponse: unknown;
  /** A deviation from the spec's literal shape, or another as-built caveat worth calling out
   *  right next to the example that would otherwise contradict it. */
  note?: string;
}

// Shared across almost every endpoint — described once here instead of repeated verbatim on
// each of the ~15 endpoints that take the same pagination/sync params.
const PARAM_DESCRIPTIONS: Record<string, string> = {
  cursor: "Opaque pagination token from the previous response's meta.next_cursor. Omit to start from the first page.",
  page_size: "Rows per page. Default 500, max 2000.",
  updated_since: "ISO 8601 timestamp — only rows updated at or after this time (incremental sync).",
  include_deleted: '"true" to include soft-deleted rows. Default false (live rows only).',
  entity_type: 'Restrict the change feed to one entity type, e.g. "task".',
  occurred_since: "ISO 8601 timestamp — only changes recorded at or after this time.",
  season_code: "Filter by the season's stable short code, e.g. \"RES H2'26\".",
  brand_code: 'Filter by the brand\'s stable short code, e.g. "BR-A".',
  status: "Filter by status.",
  blocked_status: "Filter by blocked status.",
  priority: "Filter by priority.",
  owner_name: "Filter by owner (department or person) display name.",
  owner_id: "Filter by owner profile id.",
  escalation_owner_name: "Filter by escalation owner display name.",
  delay_reason_code: "Filter by delay reason code.",
  is_milestone: '"true" to return only milestone tasks.',
  due_from: "ISO 8601 date — lower bound (inclusive) on due_date.",
  due_to: "ISO 8601 date — upper bound (inclusive) on due_date.",
  task_id: "Restrict to one task.",
  predecessor_task_id: "Filter by the dependency's predecessor task.",
  successor_task_id: "Filter by the dependency's successor task.",
  dependency_type: 'Filter by dependency type, e.g. "finish_to_start".',
  date_from: "ISO 8601 date — lower bound (inclusive).",
  date_to: "ISO 8601 date — upper bound (inclusive).",
  snapshot_grain: 'Aggregation grain for history snapshots, e.g. "daily".',
};

// Builds the {name, description} list a row of query-param chips needs from just the param
// names — one description per name, defined once above, instead of retyping the same sentence
// on every endpoint that happens to take `cursor` or `updated_since`.
function params(...names: string[]): EndpointParam[] {
  return names.map((name) => ({ name, description: PARAM_DESCRIPTIONS[name] ?? "" }));
}

export const ENDPOINT_DOCS: EndpointDoc[] = [
  {
    method: "GET",
    path: "/health",
    status: "live",
    purpose: "Basic service health check.",
    exampleResponse: {
      status: "ok",
      service: "critical-path-integration-api",
      schema_version: "v1",
      server_time: "2026-08-02T10:15:30Z",
    },
  },
  {
    method: "GET",
    path: "/seasons",
    status: "live",
    purpose: "Season master data.",
    queryParams: params("cursor", "page_size", "updated_since", "include_deleted"),
    note: "`version` is always null — this schema has no change-counter column, on seasons or anywhere else.",
    exampleResponse: {
      data: [
        {
          season_id: "b0455f54-d9dc-4d30-91f4-9cb31f44f745",
          season_code: "RES H2'26",
          season_name: "Winter 2026",
          status: "active",
          start_date: "2025-09-01",
          end_date: "2026-02-28",
          updated_at: "2026-08-02T08:12:52Z",
          deleted_at: null,
          version: null,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/changes",
    status: "planned",
    purpose: "Global incremental change feed across supported entities.",
    queryParams: params("cursor", "page_size", "entity_type", "occurred_since"),
    exampleResponse: {
      data: [
        {
          cursor: "2026-08-02T08:12:52Z_0000018842",
          entity_type: "task",
          entity_id: "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
          operation: "updated",
          occurred_at: "2026-08-02T08:12:52Z",
          version: 18,
          record: { task_id: "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a", status: "overdue", due_date: "2025-09-15" },
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/tasks",
    status: "planned",
    purpose: "Paginated task snapshot feed.",
    queryParams: params(
      "cursor",
      "page_size",
      "updated_since",
      "include_deleted",
      "season_code",
      "brand_code",
      "status",
      "blocked_status",
      "priority",
      "owner_name",
      "escalation_owner_name",
      "delay_reason_code",
      "is_milestone",
      "due_from",
      "due_to"
    ),
    note: "Most fields below have no backing column yet (blocked_status, delay_reason_code, is_milestone, planned_*/actual_* dates, version, comments_count, attachments_count, …) — see things-to-know.md before building this one.",
    exampleResponse: {
      data: [
        {
          task_id: "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
          task_name: "External Showing with Protos",
          key_stage: "Range Review",
          status: "overdue",
          blocked_status: "blocked",
          priority: "high",
          season_id: "b0455f54-d9dc-4d30-91f4-9cb31f44f745",
          season_code: "RES H2'26",
          season_name: "Winter 2026",
          brand_id: "a64f6f74-51b2-49c3-b8fd-98467f205c90",
          brand_code: "BR-A",
          brand_name: "Brand A",
          gender: "men",
          owner_name: "Brand Managers",
          assignee_name: "Leo Taylor",
          escalation_owner_name: "Oliver Smith",
          people_involved: ["Brand Managers", "Design"],
          planned_start_date: "2025-09-15",
          planned_end_date: "2025-11-24",
          working_timeline_start_date: "2025-09-15",
          working_timeline_end_date: "2025-11-24",
          actual_start_date: "2025-09-16",
          actual_end_date: null,
          duration_days: 70,
          due_date_zapier: "2025-09-15",
          due_date: "2025-09-15",
          days_at_risk: 4,
          days_late: 3,
          is_milestone: true,
          milestone_flag: "critical_milestone",
          delay_reason_code: "VENDOR_DELAY",
          delay_reason_text: "Vendor approval not received on time",
          comments_count: 2,
          attachments_count: 3,
          notes: null,
          link_url: null,
          calendar_event_id: "6as6sv1oq874m8lanuvj01efrc",
          calendar_sync_status: "synced",
          calendar_last_synced_at: "2026-08-02T08:13:00Z",
          created_at: "2025-08-20T11:00:00Z",
          updated_at: "2026-08-02T08:12:52Z",
          deleted_at: null,
          version: 18,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/tasks/{task_id}",
    status: "planned",
    purpose: "Fetch one task by ID.",
    pathParams: [{ name: "task_id", description: "The task's UUID." }],
    exampleResponse: {
      data: {
        task_id: "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
        task_name: "External Showing with Protos",
        key_stage: "Range Review",
        status: "overdue",
        blocked_status: "blocked",
        priority: "high",
        season_code: "RES H2'26",
        brand_name: "Brand A",
        owner_name: "Brand Managers",
        assignee_name: "Leo Taylor",
        escalation_owner_name: "Oliver Smith",
        people_involved: ["Brand Managers", "Design"],
        planned_start_date: "2025-09-15",
        planned_end_date: "2025-11-24",
        working_timeline_start_date: "2025-09-15",
        working_timeline_end_date: "2025-11-24",
        actual_start_date: "2025-09-16",
        actual_end_date: null,
        duration_days: 70,
        due_date_zapier: "2025-09-15",
        due_date: "2025-09-15",
        days_at_risk: 4,
        days_late: 3,
        is_milestone: true,
        milestone_flag: "critical_milestone",
        delay_reason_code: "VENDOR_DELAY",
        delay_reason_text: "Vendor approval not received on time",
        updated_at: "2026-08-02T08:12:52Z",
        deleted_at: null,
        version: 18,
      },
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z" },
    },
  },
  {
    method: "GET",
    path: "/brands",
    status: "live",
    purpose: "Brand master data.",
    queryParams: params("cursor", "page_size", "updated_since", "include_deleted"),
    note: "`version` is always null — same reasoning as /seasons, no change-counter column exists.",
    exampleResponse: {
      data: [
        {
          brand_id: "a64f6f74-51b2-49c3-b8fd-98467f205c90",
          brand_code: "BR-A",
          brand_name: "Brand A",
          description: "Premium lifestyle brand",
          status: "active",
          updated_at: "2026-08-02T08:12:52Z",
          deleted_at: null,
          version: null,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/users",
    status: "planned",
    purpose: "User master data.",
    queryParams: params("cursor", "page_size", "updated_since", "include_deleted"),
    exampleResponse: {
      data: [
        {
          user_id: "fd7f073a-ef74-4cb2-b822-b2a943026958",
          display_name: "Oliver Smith",
          email: "oliver.smith@criticalpath.com",
          department: "IT",
          role_name: "Administrator",
          status: "active",
          last_active_at: "2026-08-02T08:12:52Z",
          updated_at: "2026-08-02T08:12:52Z",
          deleted_at: null,
          version: 7,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/teams",
    status: "planned",
    purpose: "Team master data.",
    queryParams: params("cursor", "page_size", "updated_since", "include_deleted"),
    note: "\"Team\" here means department — active_tasks_count/completed_tasks_count/member_count would be computed, not stored columns.",
    exampleResponse: {
      data: [
        {
          team_id: "c0f1bbd6-85a0-46e4-8b95-f5cb2e1a5065",
          team_name: "Brand Managers",
          department: "Brand",
          lead_name: "Oliver Smith",
          member_count: 6,
          active_tasks_count: 128,
          completed_tasks_count: 128,
          status: "active",
          updated_at: "2026-08-02T08:12:52Z",
          deleted_at: null,
          version: 4,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/roles",
    status: "planned",
    purpose: "Role and permission master data.",
    queryParams: params("cursor", "page_size", "updated_since", "include_deleted"),
    note: "Would map to lib/permissions.ts's Action union + PERMISSION_CATALOG, not a database table.",
    exampleResponse: {
      data: [
        {
          role_id: "9f7ce3e6-0e94-470d-b3e0-3f84cc64654f",
          role_name: "Administrator",
          access_level: "full_access",
          status: "active",
          user_count: 3,
          permissions: [
            { permission_key: "tasks.create", access_level: "full" },
            { permission_key: "tasks.delete", access_level: "full" },
          ],
          updated_at: "2026-08-02T08:12:52Z",
          deleted_at: null,
          version: 6,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/calendar-events",
    status: "planned",
    purpose: "Calendar sync metadata tied to tasks and due dates.",
    queryParams: params("cursor", "page_size", "updated_since", "include_deleted"),
    exampleResponse: {
      data: [
        {
          calendar_event_id: "6as6sv1oq874m8lanuvj01efrc",
          task_id: "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
          task_name: "External Showing with Protos",
          provider: "google_calendar",
          season_code: "RES H2'26",
          brand_name: "Brand A",
          owner_name: "Brand Managers",
          due_date: "2025-09-15",
          sync_status: "synced",
          last_synced_at: "2026-08-02T08:13:00Z",
          event_deleted: false,
          updated_at: "2026-08-02T08:12:52Z",
          deleted_at: null,
          version: 9,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/task-dependencies",
    status: "planned",
    purpose: "Dependency data between tasks.",
    queryParams: params("cursor", "page_size", "updated_since", "include_deleted", "task_id", "predecessor_task_id", "successor_task_id", "dependency_type"),
    note: "No task_dependencies table exists in this schema — the platform doesn't model task-to-task dependencies today.",
    exampleResponse: {
      data: [
        {
          dependency_id: "4d0bff3b-f590-4d80-9b9f-8a140de03c70",
          predecessor_task_id: "11111111-1111-1111-1111-111111111111",
          predecessor_task_name: "Design Brief",
          successor_task_id: "22222222-2222-2222-2222-222222222222",
          successor_task_name: "External Showing with Protos",
          dependency_type: "finish_to_start",
          lag_days: 2,
          is_blocking: true,
          updated_at: "2026-08-02T08:12:52Z",
          deleted_at: null,
          version: 2,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/delay-reason-codes",
    status: "planned",
    purpose: "Master list of reason codes for delay reporting.",
    queryParams: params("cursor", "page_size", "updated_since", "include_deleted"),
    note: "No delay_reason_codes table exists — delay reasons aren't tracked as structured data on a task today.",
    exampleResponse: {
      data: [
        {
          reason_code: "VENDOR_DELAY",
          label: "Vendor delay",
          description: "Third-party supplier or vendor caused a schedule delay",
          category: "external",
          active: true,
          updated_at: "2026-08-02T08:12:52Z",
          deleted_at: null,
          version: 1,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:15:30Z", next_cursor: null, page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/dashboard-summary",
    status: "planned",
    purpose: "Optional summary endpoint for the dashboard headline values.",
    queryParams: params("season_code", "brand_code", "owner_id", "date_from", "date_to"),
    exampleResponse: {
      data: {
        as_of: "2026-08-02T10:30:00Z",
        generated_at: "2026-08-02T10:30:05Z",
        metric_definition_version: "v1",
        filters: { season_code: null, brand_code: null, owner_id: null, date_from: "2026-08-01", date_to: "2026-08-31" },
        totals: { total_tasks: 128, completed_tasks: 45, in_progress_tasks: 58, overdue_tasks: 25, completion_rate: 35.2 },
        breakdowns: {
          by_status: [{ status: "completed", count: 45 }],
          by_season: [{ season_code: "RES H2'26", count: 420, percent: 33.7 }],
          by_brand: [{ brand_name: "Brand A", count: 420, percent: 33.7 }],
        },
      },
      meta: { schema_version: "v1", as_of: "2026-08-02T10:30:00Z" },
    },
  },
  {
    method: "GET",
    path: "/reports/task-summary",
    status: "planned",
    purpose: "Optional report summary endpoint for filtered report views.",
    queryParams: params("date_from", "date_to", "season_code", "brand_code", "owner_name", "status"),
    exampleResponse: {
      data: {
        as_of: "2026-08-02T10:30:00Z",
        generated_at: "2026-08-02T10:30:05Z",
        metric_definition_version: "v1",
        filters: { date_from: "2026-05-01", date_to: "2026-05-31", season_code: null, brand_code: null, owner_name: null, status: null },
        totals: { total_tasks: 248, completed_tasks: 98, in_progress_tasks: 65, overdue_tasks: 10 },
        breakdowns: { by_status: [], by_season: [], by_brand: [], by_owner: [] },
      },
      meta: { schema_version: "v1", as_of: "2026-08-02T10:30:00Z" },
    },
  },
  {
    method: "GET",
    path: "/reports/overdue-tasks",
    status: "planned",
    purpose: "Optional report endpoint for overdue task lists.",
    queryParams: params("cursor", "page_size", "season_code", "brand_code", "owner_name", "due_from", "due_to"),
    exampleResponse: {
      data: [
        {
          task_id: "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
          task_name: "External Showing with Protos",
          season_code: "RES H2'26",
          brand_name: "Brand A",
          owner_name: "Brand Managers",
          due_date: "2025-09-15",
          status: "overdue",
          days_overdue: 3,
          updated_at: "2026-08-02T08:12:52Z",
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:30:00Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/reports/blocked-tasks",
    status: "planned",
    purpose: "Optional report endpoint for blocked task lists.",
    queryParams: params("cursor", "page_size", "season_code", "brand_code", "owner_name", "blocked_status", "escalation_owner_name", "delay_reason_code"),
    exampleResponse: {
      data: [
        {
          task_id: "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
          task_name: "External Showing with Protos",
          key_stage: "Range Review",
          owner_name: "Brand Managers",
          people_involved: ["Brand Managers", "Design"],
          blocked_status: "blocked",
          escalation_owner_name: "Oliver Smith",
          delay_reason_code: "VENDOR_DELAY",
          days_at_risk: 4,
          days_late: 3,
          due_date: "2025-09-15",
          updated_at: "2026-08-02T08:12:52Z",
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:30:00Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
  {
    method: "GET",
    path: "/reports/tasks-by-season",
    status: "planned",
    purpose: "Optional report endpoint for season-level grouped metrics.",
    queryParams: params("date_from", "date_to", "brand_code", "owner_name", "status"),
    exampleResponse: {
      data: [
        {
          season_id: "b0455f54-d9dc-4d30-91f4-9cb31f44f745",
          season_code: "RES H2'26",
          season_name: "Winter 2026",
          task_count: 248,
          completed_count: 98,
          in_progress_count: 65,
          overdue_count: 10,
          completion_rate: 39.5,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:30:00Z" },
    },
  },
  {
    method: "GET",
    path: "/reports/tasks-by-brand",
    status: "planned",
    purpose: "Optional report endpoint for brand-level grouped metrics.",
    queryParams: params("date_from", "date_to", "season_code", "owner_name", "status"),
    exampleResponse: {
      data: [
        {
          brand_id: "a64f6f74-51b2-49c3-b8fd-98467f205c90",
          brand_code: "BR-A",
          brand_name: "Brand A",
          task_count: 128,
          completed_count: 52,
          in_progress_count: 38,
          overdue_count: 10,
          completion_rate: 40.6,
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:30:00Z" },
    },
  },
  {
    method: "GET",
    path: "/task-history-snapshots",
    status: "planned",
    purpose: "Historical snapshots for trend charts over time.",
    queryParams: params("cursor", "page_size", "task_id", "season_code", "brand_code", "owner_name", "date_from", "date_to", "snapshot_grain"),
    note: "No task_history_snapshots table exists — this platform doesn't retain daily point-in-time snapshots of a task today.",
    exampleResponse: {
      data: [
        {
          snapshot_date: "2026-07-25",
          task_id: "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
          task_name: "External Showing with Protos",
          key_stage: "Range Review",
          owner_name: "Brand Managers",
          people_involved: ["Brand Managers", "Design"],
          planned_start_date: "2025-09-15",
          planned_end_date: "2025-11-24",
          working_timeline_start_date: "2025-09-15",
          working_timeline_end_date: "2025-11-24",
          actual_start_date: "2025-09-16",
          actual_end_date: null,
          duration_days: 70,
          due_date_zapier: "2025-09-15",
          due_date: "2025-09-15",
          status: "in_progress",
          blocked_status: "blocked",
          days_at_risk: 4,
          days_late: 3,
          is_milestone: true,
          milestone_flag: "critical_milestone",
          escalation_owner_name: "Oliver Smith",
          delay_reason_code: "VENDOR_DELAY",
        },
      ],
      meta: { schema_version: "v1", as_of: "2026-08-02T10:30:00Z", next_cursor: "opaque-cursor-value", page_size: 500 },
    },
  },
];

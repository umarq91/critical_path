# Critical Path Integration API Spec (Databricks/Kong)

> Source: `TBO Critical Path Integration API Spec.pdf`, supplied by the client's data engineer.
> Transcribed verbatim (structure preserved) on 2026-08-16 for version control and searchability.
>
> **Status: in progress, built incrementally.** Originally out of scope (see `plan.md` §8's
> history of that decision), now reversed by explicit client direction. The foundation — API-key
> issuance/management (`/management/integrations`) and the auth check every endpoint below will
> share — is live, along with `GET /health` as a proof-of-life endpoint. **Every other endpoint
> in this document is still just a target shape, not something built yet** — most of the `tasks`
> fields below (`blocked_status`, `delay_reason_code`, `is_milestone`, `planned_*`/`actual_*`
> dates, `version`, `comments_count`, …) have no column to back them in the current schema, and
> `task_dependencies`/`delay_reason_codes`/`task_history_snapshots` don't exist as tables at all.
> Each endpoint gets built one at a time, against real columns only — see
> `things-to-know.md`'s Integrations section for the as-built auth mechanism and what's live so
> far, and don't build a data endpoint here by inventing the columns it would need.

## Purpose

This API should let Databricks ingest Critical Path operational data through Kong using a stable,
read-only integration API.

## Core Entities

- `tasks`
- `seasons`
- `brands`
- `users`
- `teams`
- `roles`
- `permissions`
- `calendar_events`
- `task_dependencies`
- `delay_reason_codes`
- `task_history_snapshots`

## Integration Principles

- Use a separate integration namespace instead of reusing front-end screen endpoints.
- Support both full loads and incremental syncs.
- Return the underlying source records, not only UI summary values.
- Allow optional summary endpoints for dashboard and report views.
- Include API version in the path and schema version in the response metadata.

## Security Through Kong

Use the simpler fallback: `Key Auth` with a header API key.

Required headers:

- `apikey`: API key
- `Accept: application/json`
- `X-Request-Id`: unique ID for one API request
- `X-Correlation-Id`: ID used to trace one sync run across systems

Use `Content-Type: application/json` for requests that send a JSON body.

## API Conventions

- Base path: `/integration/v1`
- Timestamps: ISO 8601 UTC, for example `2026-08-02T10:15:30Z`
- Dates: ISO 8601 date, for example `2026-09-15`
- IDs: UUID preferred
- Pagination: cursor-based
- Default page size: `500`
- Max page size: `2000`
- Incremental sync field: `updated_at`
- Soft deletes: use `deleted_at`
- Response metadata should include `schema_version`

## Full Load And Incremental Sync

Full load example:

- Databricks repeatedly calls `GET /integration/v1/tasks?page_size=1000&cursor=...` and follows each
  returned `next_cursor` until no `next_cursor` is returned.

Incremental sync examples:

- `GET /integration/v1/tasks?updated_since=2026-08-01T00:00:00Z`
- `GET /integration/v1/changes?cursor=2026-08-01T00:00:00Z_000123`

## Shared Response Meta Sketch

Most list endpoints can return a shared `meta` block like this:

```json
{
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

---

## Endpoint Breakdown

> Note (from the source spec): the schemas below are rough sketches and should stay flexible based on
> the data available. They may also change with endpoint parameters.

### `GET /health`

Purpose: basic service health check

```json
{
  "status": "ok",
  "service": "critical-path-integration-api",
  "schema_version": "v1",
  "server_time": "2026-08-02T10:15:30Z"
}
```

### `GET /changes`

Purpose: global incremental change feed across supported entities

Query parameters: `cursor`, `page_size`, `entity_type`, `occurred_since`

```json
{
  "data": [
    {
      "cursor": "2026-08-02T08:12:52Z_0000018842",
      "entity_type": "task",
      "entity_id": "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
      "operation": "updated",
      "occurred_at": "2026-08-02T08:12:52Z",
      "version": 18,
      "record": {
        "task_id": "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
        "status": "overdue",
        "due_date": "2025-09-15"
      }
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /tasks`

Purpose: paginated task snapshot feed

Query parameters: `cursor`, `page_size`, `updated_since`, `include_deleted`, `season_code`,
`brand_code`, `status`, `blocked_status`, `priority`, `owner_name`, `escalation_owner_name`,
`delay_reason_code`, `is_milestone`, `due_from`, `due_to`

```json
{
  "data": [
    {
      "task_id": "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
      "task_name": "External Showing with Protos",
      "key_stage": "Range Review",
      "status": "overdue",
      "blocked_status": "blocked",
      "priority": "high",
      "season_id": "b0455f54-d9dc-4d30-91f4-9cb31f44f745",
      "season_code": "RES H2'26",
      "season_name": "Winter 2026",
      "brand_id": "a64f6f74-51b2-49c3-b8fd-98467f205c90",
      "brand_code": "BR-A",
      "brand_name": "Brand A",
      "gender": "men",
      "owner_name": "Brand Managers",
      "assignee_name": "Leo Taylor",
      "escalation_owner_name": "Oliver Smith",
      "people_involved": ["Brand Managers", "Design"],
      "planned_start_date": "2025-09-15",
      "planned_end_date": "2025-11-24",
      "working_timeline_start_date": "2025-09-15",
      "working_timeline_end_date": "2025-11-24",
      "actual_start_date": "2025-09-16",
      "actual_end_date": null,
      "duration_days": 70,
      "due_date_zapier": "2025-09-15",
      "due_date": "2025-09-15",
      "days_at_risk": 4,
      "days_late": 3,
      "is_milestone": true,
      "milestone_flag": "critical_milestone",
      "delay_reason_code": "VENDOR_DELAY",
      "delay_reason_text": "Vendor approval not received on time",
      "comments_count": 2,
      "attachments_count": 3,
      "notes": null,
      "link_url": null,
      "calendar_event_id": "6as6sv1oq874m8lanuvj01efrc",
      "calendar_sync_status": "synced",
      "calendar_last_synced_at": "2026-08-02T08:13:00Z",
      "created_at": "2025-08-20T11:00:00Z",
      "updated_at": "2026-08-02T08:12:52Z",
      "deleted_at": null,
      "version": 18
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /tasks/{task_id}`

Purpose: fetch one task by ID

Path parameters: `task_id`

```json
{
  "data": {
    "task_id": "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
    "task_name": "External Showing with Protos",
    "key_stage": "Range Review",
    "status": "overdue",
    "blocked_status": "blocked",
    "priority": "high",
    "season_code": "RES H2'26",
    "brand_name": "Brand A",
    "owner_name": "Brand Managers",
    "assignee_name": "Leo Taylor",
    "escalation_owner_name": "Oliver Smith",
    "people_involved": ["Brand Managers", "Design"],
    "planned_start_date": "2025-09-15",
    "planned_end_date": "2025-11-24",
    "working_timeline_start_date": "2025-09-15",
    "working_timeline_end_date": "2025-11-24",
    "actual_start_date": "2025-09-16",
    "actual_end_date": null,
    "duration_days": 70,
    "due_date_zapier": "2025-09-15",
    "due_date": "2025-09-15",
    "days_at_risk": 4,
    "days_late": 3,
    "is_milestone": true,
    "milestone_flag": "critical_milestone",
    "delay_reason_code": "VENDOR_DELAY",
    "delay_reason_text": "Vendor approval not received on time",
    "updated_at": "2026-08-02T08:12:52Z",
    "deleted_at": null,
    "version": 18
  },
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z"
  }
}
```

### `GET /seasons`

Purpose: season master data

Query parameters: `cursor`, `page_size`, `updated_since`, `include_deleted`

```json
{
  "data": [
    {
      "season_id": "b0455f54-d9dc-4d30-91f4-9cb31f44f745",
      "season_code": "RES H2'26",
      "season_name": "Winter 2026",
      "status": "active",
      "start_date": "2025-09-01",
      "end_date": "2026-02-28",
      "updated_at": "2026-08-02T08:12:52Z",
      "deleted_at": null,
      "version": 5
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /brands`

Purpose: brand master data

Query parameters: `cursor`, `page_size`, `updated_since`, `include_deleted`

```json
{
  "data": [
    {
      "brand_id": "a64f6f74-51b2-49c3-b8fd-98467f205c90",
      "brand_code": "BR-A",
      "brand_name": "Brand A",
      "description": "Premium lifestyle brand",
      "status": "active",
      "updated_at": "2026-08-02T08:12:52Z",
      "deleted_at": null,
      "version": 3
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /users`

Purpose: user master data

Query parameters: `cursor`, `page_size`, `updated_since`, `include_deleted`

```json
{
  "data": [
    {
      "user_id": "fd7f073a-ef74-4cb2-b822-b2a943026958",
      "display_name": "Oliver Smith",
      "email": "oliver.smith@criticalpath.com",
      "department": "IT",
      "role_name": "Administrator",
      "status": "active",
      "last_active_at": "2026-08-02T08:12:52Z",
      "updated_at": "2026-08-02T08:12:52Z",
      "deleted_at": null,
      "version": 7
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /teams`

Purpose: team master data

Query parameters: `cursor`, `page_size`, `updated_since`, `include_deleted`

```json
{
  "data": [
    {
      "team_id": "c0f1bbd6-85a0-46e4-8b95-f5cb2e1a5065",
      "team_name": "Brand Managers",
      "department": "Brand",
      "lead_name": "Oliver Smith",
      "member_count": 6,
      "active_tasks_count": 128,
      "completed_tasks_count": 128,
      "status": "active",
      "updated_at": "2026-08-02T08:12:52Z",
      "deleted_at": null,
      "version": 4
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /roles`

Purpose: role and permission master data

Query parameters: `cursor`, `page_size`, `updated_since`, `include_deleted`

```json
{
  "data": [
    {
      "role_id": "9f7ce3e6-0e94-470d-b3e0-3f84cc64654f",
      "role_name": "Administrator",
      "access_level": "full_access",
      "status": "active",
      "user_count": 3,
      "permissions": [
        { "permission_key": "tasks.create", "access_level": "full" },
        { "permission_key": "tasks.delete", "access_level": "full" }
      ],
      "updated_at": "2026-08-02T08:12:52Z",
      "deleted_at": null,
      "version": 6
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /calendar-events`

Purpose: calendar sync metadata tied to tasks and due dates

Query parameters: `cursor`, `page_size`, `updated_since`, `include_deleted`

```json
{
  "data": [
    {
      "calendar_event_id": "6as6sv1oq874m8lanuvj01efrc",
      "task_id": "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
      "task_name": "External Showing with Protos",
      "provider": "google_calendar",
      "season_code": "RES H2'26",
      "brand_name": "Brand A",
      "owner_name": "Brand Managers",
      "due_date": "2025-09-15",
      "sync_status": "synced",
      "last_synced_at": "2026-08-02T08:13:00Z",
      "event_deleted": false,
      "updated_at": "2026-08-02T08:12:52Z",
      "deleted_at": null,
      "version": 9
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /task-dependencies`

Purpose: dependency data between tasks

Query parameters: `cursor`, `page_size`, `updated_since`, `include_deleted`, `task_id`,
`predecessor_task_id`, `successor_task_id`, `dependency_type`

```json
{
  "data": [
    {
      "dependency_id": "4d0bff3b-f590-4d80-9b9f-8a140de03c70",
      "predecessor_task_id": "11111111-1111-1111-1111-111111111111",
      "predecessor_task_name": "Design Brief",
      "successor_task_id": "22222222-2222-2222-2222-222222222222",
      "successor_task_name": "External Showing with Protos",
      "dependency_type": "finish_to_start",
      "lag_days": 2,
      "is_blocking": true,
      "updated_at": "2026-08-02T08:12:52Z",
      "deleted_at": null,
      "version": 2
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /delay-reason-codes`

Purpose: master list of reason codes for delay reporting

Query parameters: `cursor`, `page_size`, `updated_since`, `include_deleted`

```json
{
  "data": [
    {
      "reason_code": "VENDOR_DELAY",
      "label": "Vendor delay",
      "description": "Third-party supplier or vendor caused a schedule delay",
      "category": "external",
      "active": true,
      "updated_at": "2026-08-02T08:12:52Z",
      "deleted_at": null,
      "version": 1
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:15:30Z",
    "next_cursor": null,
    "page_size": 500
  }
}
```

### `GET /dashboard-summary`

Purpose: optional summary endpoint for the dashboard headline values

Query parameters: `season_code`, `brand_code`, `owner_id`, `date_from`, `date_to`

```json
{
  "data": {
    "as_of": "2026-08-02T10:30:00Z",
    "generated_at": "2026-08-02T10:30:05Z",
    "metric_definition_version": "v1",
    "filters": {
      "season_code": null,
      "brand_code": null,
      "owner_id": null,
      "date_from": "2026-08-01",
      "date_to": "2026-08-31"
    },
    "totals": {
      "total_tasks": 128,
      "completed_tasks": 45,
      "in_progress_tasks": 58,
      "overdue_tasks": 25,
      "completion_rate": 35.2
    },
    "breakdowns": {
      "by_status": [{ "status": "completed", "count": 45 }],
      "by_season": [{ "season_code": "RES H2'26", "count": 420, "percent": 33.7 }],
      "by_brand": [{ "brand_name": "Brand A", "count": 420, "percent": 33.7 }]
    }
  },
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:30:00Z"
  }
}
```

### `GET /reports/task-summary`

Purpose: optional report summary endpoint for filtered report views

Query parameters: `date_from`, `date_to`, `season_code`, `brand_code`, `owner_name`, `status`

```json
{
  "data": {
    "as_of": "2026-08-02T10:30:00Z",
    "generated_at": "2026-08-02T10:30:05Z",
    "metric_definition_version": "v1",
    "filters": {
      "date_from": "2026-05-01",
      "date_to": "2026-05-31",
      "season_code": null,
      "brand_code": null,
      "owner_name": null,
      "status": null
    },
    "totals": {
      "total_tasks": 248,
      "completed_tasks": 98,
      "in_progress_tasks": 65,
      "overdue_tasks": 10
    },
    "breakdowns": {
      "by_status": [],
      "by_season": [],
      "by_brand": [],
      "by_owner": []
    }
  },
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:30:00Z"
  }
}
```

### `GET /reports/overdue-tasks`

Purpose: optional report endpoint for overdue task lists

Query parameters: `cursor`, `page_size`, `season_code`, `brand_code`, `owner_name`, `due_from`, `due_to`

```json
{
  "data": [
    {
      "task_id": "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
      "task_name": "External Showing with Protos",
      "season_code": "RES H2'26",
      "brand_name": "Brand A",
      "owner_name": "Brand Managers",
      "due_date": "2025-09-15",
      "status": "overdue",
      "days_overdue": 3,
      "updated_at": "2026-08-02T08:12:52Z"
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:30:00Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /reports/blocked-tasks`

Purpose: optional report endpoint for blocked task lists

Query parameters: `cursor`, `page_size`, `season_code`, `brand_code`, `owner_name`, `blocked_status`,
`escalation_owner_name`, `delay_reason_code`

```json
{
  "data": [
    {
      "task_id": "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
      "task_name": "External Showing with Protos",
      "key_stage": "Range Review",
      "owner_name": "Brand Managers",
      "people_involved": ["Brand Managers", "Design"],
      "blocked_status": "blocked",
      "escalation_owner_name": "Oliver Smith",
      "delay_reason_code": "VENDOR_DELAY",
      "days_at_risk": 4,
      "days_late": 3,
      "due_date": "2025-09-15",
      "updated_at": "2026-08-02T08:12:52Z"
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:30:00Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

### `GET /reports/tasks-by-season`

Purpose: optional report endpoint for season-level grouped metrics

Query parameters: `date_from`, `date_to`, `brand_code`, `owner_name`, `status`

```json
{
  "data": [
    {
      "season_id": "b0455f54-d9dc-4d30-91f4-9cb31f44f745",
      "season_code": "RES H2'26",
      "season_name": "Winter 2026",
      "task_count": 248,
      "completed_count": 98,
      "in_progress_count": 65,
      "overdue_count": 10,
      "completion_rate": 39.5
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:30:00Z"
  }
}
```

### `GET /reports/tasks-by-brand`

Purpose: optional report endpoint for brand-level grouped metrics

Query parameters: `date_from`, `date_to`, `season_code`, `owner_name`, `status`

```json
{
  "data": [
    {
      "brand_id": "a64f6f74-51b2-49c3-b8fd-98467f205c90",
      "brand_code": "BR-A",
      "brand_name": "Brand A",
      "task_count": 128,
      "completed_count": 52,
      "in_progress_count": 38,
      "overdue_count": 10,
      "completion_rate": 40.6
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:30:00Z"
  }
}
```

### `GET /task-history-snapshots`

Purpose: historical snapshots for trend charts over time

Query parameters: `cursor`, `page_size`, `task_id`, `season_code`, `brand_code`, `owner_name`,
`date_from`, `date_to`, `snapshot_grain`

```json
{
  "data": [
    {
      "snapshot_date": "2026-07-25",
      "task_id": "8d4a29e9-c1c4-4b80-b66b-eeb0b6277f3a",
      "task_name": "External Showing with Protos",
      "key_stage": "Range Review",
      "owner_name": "Brand Managers",
      "people_involved": ["Brand Managers", "Design"],
      "planned_start_date": "2025-09-15",
      "planned_end_date": "2025-11-24",
      "working_timeline_start_date": "2025-09-15",
      "working_timeline_end_date": "2025-11-24",
      "actual_start_date": "2025-09-16",
      "actual_end_date": null,
      "duration_days": 70,
      "due_date_zapier": "2025-09-15",
      "due_date": "2025-09-15",
      "status": "in_progress",
      "blocked_status": "blocked",
      "days_at_risk": 4,
      "days_late": 3,
      "is_milestone": true,
      "milestone_flag": "critical_milestone",
      "escalation_owner_name": "Oliver Smith",
      "delay_reason_code": "VENDOR_DELAY"
    }
  ],
  "meta": {
    "schema_version": "v1",
    "as_of": "2026-08-02T10:30:00Z",
    "next_cursor": "opaque-cursor-value",
    "page_size": 500
  }
}
```

## Minimum Change Feed Values

Minimum operations:

- `created`
- `updated`
- `deleted`

Minimum entity types:

- `task`
- `season`
- `brand`
- `user`
- `team`
- `role`
- `calendar_event`
- `task_dependency`
- `delay_reason_code`
- `task_history_snapshot`

import { NextResponse, type NextRequest } from "next/server";
import { requireIntegrationApiKey } from "@/lib/integration/auth";
import { withIntegrationTraceHeaders, integrationError } from "@/lib/integration/response";
import { getTaskByIdForIntegration, toIntegrationTaskRecord } from "@/lib/integration/tasks";

// Sibling of GET /tasks, single-row lookup by id. No deleted_at filter — see
// lib/integration/tasks.ts's getTaskByIdForIntegration for why a soft-deleted task still
// resolves here rather than 404ing.
export async function GET(request: NextRequest, ctx: RouteContext<"/integration/v1/tasks/[task_id]">) {
  const auth = await requireIntegrationApiKey(request);
  if (!auth.ok) return auth.response;

  const { task_id: taskId } = await ctx.params;

  try {
    const task = await getTaskByIdForIntegration(taskId);
    if (!task) return integrationError(request, 404, "Task not found");

    return withIntegrationTraceHeaders(
      NextResponse.json({
        data: toIntegrationTaskRecord(task),
        meta: { schema_version: "v1", as_of: new Date().toISOString() },
      }),
      request
    );
  } catch {
    return integrationError(request, 400, "Invalid task_id");
  }
}

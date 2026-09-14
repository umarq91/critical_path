import "server-only";
import { NextResponse, type NextRequest } from "next/server";

// The spec lists X-Request-Id/X-Correlation-Id as required Kong headers (see
// docs/databricks-integration-api-spec.md) — not enforced (a missing one doesn't reject the
// request, since Kong's actual outgoing header set isn't confirmed yet), but echoed back
// verbatim on every response, success or error. That's the traceability the spec is actually
// after: the caller can match a response to the request that produced it, and correlate it
// against Kong/Databricks' own logs for that sync run, without this app needing a request-log
// table or (CLAUDE.md-barred) console.log to get there.
export function withIntegrationTraceHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const requestId = request.headers.get("x-request-id");
  const correlationId = request.headers.get("x-correlation-id");
  if (requestId) response.headers.set("X-Request-Id", requestId);
  if (correlationId) response.headers.set("X-Correlation-Id", correlationId);
  return response;
}

// The one error envelope every /integration/v1/* route returns, trace-headers included —
// mirrors tasks/export/route.ts's own errorResponse, generalised across a whole route family
// instead of colocated in one file since every endpoint here needs the same shape.
export function integrationError(request: NextRequest, status: number, message: string): NextResponse {
  return withIntegrationTraceHeaders(NextResponse.json({ error: message }, { status }), request);
}

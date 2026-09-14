"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { EndpointDoc } from "@/app/(app)/management/integrations/docs/endpoint-docs";

const ENDPOINT_STATUS_CONFIG = {
  live: { label: "Live", className: "border border-status-complete-base bg-status-complete-soft text-status-complete-text" },
  planned: { label: "Planned", className: "border border-border-strong bg-muted text-muted-foreground" },
};

// One row per endpoint in ENDPOINT_DOCS — collapsed by default (unlike the "How this works"
// card, there are ~19 of these, so opening all of them at once would just be a wall of JSON).
export const EndpointDocRow = ({ endpoint }: { endpoint: EndpointDoc }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="gap-0 py-0">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 rounded border border-border-strong bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              {endpoint.method}
            </span>
            <span className="truncate font-mono text-sm text-foreground">{endpoint.path}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <StatusBadge value={endpoint.status} config={ENDPOINT_STATUS_CONFIG} />
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-4 border-t border-border px-4 py-4">
            <p className="text-sm text-muted-foreground">{endpoint.purpose}</p>

            {endpoint.note ? (
              <p className="rounded-lg border border-border-strong bg-muted px-3 py-2 text-sm text-foreground">
                {endpoint.note}
              </p>
            ) : null}

            {endpoint.pathParams ? <ParamList title="Path parameters" items={endpoint.pathParams} /> : null}
            {endpoint.queryParams ? <ParamList title="Query parameters" items={endpoint.queryParams} /> : null}

            <div className="flex flex-col gap-1.5">
              <span className="text-overline text-muted-foreground">Required headers</span>
              <p className="text-sm text-muted-foreground">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">apikey</code> — every request.
                See the &quot;How this works&quot; card above for where it goes.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-overline text-muted-foreground">Example response</span>
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-xs text-foreground">
                <code>{JSON.stringify(endpoint.exampleResponse, null, 2)}</code>
              </pre>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

function ParamList({ title, items }: { title: string; items: { name: string; description: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-overline text-muted-foreground">{title}</span>
      <dl className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.name} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
            <dt className="shrink-0 font-mono text-xs text-foreground sm:w-44">{item.name}</dt>
            <dd className="text-sm text-muted-foreground">{item.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

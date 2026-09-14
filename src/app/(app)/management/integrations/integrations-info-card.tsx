"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface IntegrationsInfoCardProps {
  baseUrl: string;
}

// Plain-language explanation for whoever's setting up the external side (Kong, Databricks, or
// anything else calling in) — what this API is, where a key goes, and what's actually callable
// today. See things-to-know.md's Integrations section for the as-built rules this restates,
// and docs/databricks-integration-api-spec.md for the target shape once more endpoints land.
// Collapsible (open by default), same pattern as settings/notifications' own info card.
export const IntegrationsInfoCard = ({ baseUrl }: IntegrationsInfoCardProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-(--card-spacing) py-(--card-spacing) text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center gap-2 text-base font-medium text-foreground">
            <Info className="size-4 text-muted-foreground" />
            How this works
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="flex flex-col gap-3 pt-0">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                This is a <span className="text-foreground">read-only</span> API for an external system to pull data
                out — nothing created or edited here can write back into Critical Path.
              </li>
              <li>
                Every request goes to{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{baseUrl}/integration/v1/…</code>
                , with your key sent as an <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">apikey</code>{" "}
                request header — not a query param, not <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">Authorization</code>.
              </li>
              <li>
                Paste the key into whatever&apos;s calling in — Kong&apos;s Key Auth credential for this consumer, a
                Databricks secret, an env var — wherever the other system keeps its own secrets. It belongs there,
                not in a shared doc or chat message.
              </li>
              <li>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">GET /integration/v1/health</code>{" "}
                and <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">GET /integration/v1/seasons</code>{" "}
                are live today. More endpoints (tasks, brands, …) are being added one at a time; a key created now
                will work against those as they land, no new key needed.
              </li>
              <li>
                A field that comes back <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">null</code>{" "}
                means one of two things: that record genuinely has nothing set for it, or Critical Path doesn&apos;t
                track that data at all yet (e.g. every endpoint&apos;s <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">version</code>{" "}
                field — there&apos;s no change-counter column in this schema, so it&apos;s always <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">null</code>,
                never a real number). The response shape follows the spec either way rather than omitting a field
                outright.
              </li>
              <li>
                A key is shown once, right after you create it — copy it immediately. If it&apos;s lost, there&apos;s
                nothing to recover: revoke it and issue a new one.
              </li>
              <li>Revoking takes effect immediately — anything still sending that key starts getting a 401.</li>
            </ul>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

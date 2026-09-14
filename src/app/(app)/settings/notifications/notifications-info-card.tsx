"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface NotificationsInfoCardProps {
  timezoneLabel: string;
}

// Plain-language explanation of the mechanics behind the two cards below — see
// things-to-know.md's Reminders section for the full as-built rules this is a friendlier
// restatement of. Collapsible (open by default) so a first-time visitor sees it immediately,
// but it doesn't keep competing for attention once someone already knows how this works.
export const NotificationsInfoCard = ({ timezoneLabel }: NotificationsInfoCardProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Card className="lg:col-span-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-(--card-spacing) py-(--card-spacing) text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center gap-2 text-base font-medium text-foreground">
            <Info className="size-4 text-muted-foreground" />
            How this works
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>Reminders are personal — only the tasks you pick below get emailed to you, no one else.</li>
              <li>
                Choose one or more &quot;days before due date&quot; timings and a time of day below; your email goes
                out within about 15 minutes of that time, in {timezoneLabel} time.
              </li>
              <li>A task needs a due date to be reminded about — anything without one is skipped, even if selected.</li>
              <li>Completed or deleted tasks are dropped automatically, even if still on your list.</li>
              <li>Each timing only ever sends once per task, so you won&apos;t get the same reminder twice.</li>
              <li>Turn &quot;Reminders on&quot; off any time to pause everything without losing your saved tasks or timings.</li>
            </ul>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  /** Header-right slot — the per-card filter dropdown, a granularity toggle, a "View all" link. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

// The shell every dashboard chart sits in — title, optional description, body. Charts pass
// their own content; this owns nothing chart-specific so a table or a stat list can use it too.
export const ChartCard = ({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: ChartCardProps) => {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="text-h3 text-foreground">{title}</CardTitle>
        {description ? <CardDescription className="text-body">{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
};

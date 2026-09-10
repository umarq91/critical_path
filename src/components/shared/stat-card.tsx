import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string | number;
  description?: string;
  /** Turns the tile into a jumping-off point — e.g. Overdue → /tasks filtered to overdue. */
  href?: string;
  linkLabel?: string;
  className?: string;
}

export const StatCard = ({
  icon: Icon,
  iconClassName,
  label,
  value,
  description,
  href,
  linkLabel,
  className,
}: StatCardProps) => {
  return (
    <Card className={cn("flex-row items-start gap-3 px-4", className)}>
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted", iconClassName)}>
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        {href ? (
          <Link
            href={href}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {linkLabel ?? "View all"}
            <ArrowRight className="size-3" />
          </Link>
        ) : null}
      </div>
    </Card>
  );
};

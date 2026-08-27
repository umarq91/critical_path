import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string | number;
  description?: string;
  className?: string;
}

export const StatCard = ({ icon: Icon, iconClassName, label, value, description, className }: StatCardProps) => {
  return (
    <Card className={cn("flex-row items-start gap-3 px-4", className)}>
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted", iconClassName)}>
        <Icon className="size-5" />
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
    </Card>
  );
};

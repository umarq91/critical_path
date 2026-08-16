import { Badge } from "@/components/ui/badge";

export interface StatusBadgeConfigEntry {
  label: string;
  className: string;
}

export type StatusBadgeConfig = Record<string, StatusBadgeConfigEntry>;

interface StatusBadgeProps {
  value: string;
  config: StatusBadgeConfig;
}

export const StatusBadge = ({ value, config }: StatusBadgeProps) => {
  const entry = config[value];
  return (
    <Badge variant="ghost" className={entry?.className}>
      {entry?.label ?? value}
    </Badge>
  );
};

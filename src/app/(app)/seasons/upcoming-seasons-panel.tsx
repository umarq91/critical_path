import { Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { listUpcomingSeasons } from "@/data/seasons";

interface UpcomingSeasonsPanelProps {
  seasons: Awaited<ReturnType<typeof listUpcomingSeasons>>;
}

export const UpcomingSeasonsPanel = ({ seasons }: UpcomingSeasonsPanelProps) => {
  return (
    <Card className="gap-3 px-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Upcoming Seasons</p>
        <button type="button" className="text-sm font-medium text-primary hover:underline">
          View All
        </button>
      </div>
      {seasons.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No upcoming seasons.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {seasons.map((season) => (
            <li key={season.id} className="flex items-center gap-2.5 py-2.5">
              <Calendar className="size-4 shrink-0 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{season.season}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

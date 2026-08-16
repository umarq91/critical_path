import { Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Season } from "@/data/seasons";

function daysUntil(startDate: string) {
  const diff = new Date(startDate).getTime() - Date.now();
  return Math.max(Math.round(diff / (1000 * 60 * 60 * 24)), 0);
}

export const UpcomingSeasonsPanel = ({ seasons }: { seasons: Season[] }) => {
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
            <li key={season.id} className="flex items-start gap-2.5 py-2.5">
              <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{season.season_name}</p>
                <p className="text-xs text-muted-foreground">Starts in {daysUntil(season.start_date)} days</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

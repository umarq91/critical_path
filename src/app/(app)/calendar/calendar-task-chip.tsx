import { ColorTag } from "@/components/shared/color-tag";
import { taskSeasonColor } from "@/app/(app)/tasks/task-season-color";
import { PartyStack } from "@/app/(app)/tasks/party-stack";
import { taskOwners } from "@/app/(app)/tasks/task-parties";
import type { Task } from "@/data/tasks";

interface CalendarTaskChipProps {
  task: Task;
  onSelect: (task: Task) => void;
  variant?: "compact" | "full";
}

export const CalendarTaskChip = ({ task, onSelect, variant = "compact" }: CalendarTaskChipProps) => {
  const owners = taskOwners(task);
  // Season colour (shared with the Timeline, see task-season-color.ts) as a tint over border and
  // text, same treatment as ColorTag, since it's an arbitrary hex with no Tailwind utility.
  // Status isn't shown on the chip (its status dot was removed by client request).
  const seasonColor = taskSeasonColor(task);

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={() => onSelect(task)}
        className="flex w-full items-center gap-1.5 truncate rounded-sm border px-1.5 py-0.5 text-left text-xs transition-all duration-150 hover:shadow-sm hover:brightness-95 active:scale-[0.98]"
        style={{ borderColor: seasonColor, backgroundColor: `${seasonColor}1a`, color: seasonColor }}
        title={task.task_name}
      >
        <span className="truncate">{task.task_name}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      className="flex w-full min-w-0 flex-col gap-2 rounded-lg border p-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.99]"
      style={{ borderColor: seasonColor, backgroundColor: `${seasonColor}14` }}
      title={task.task_name}
    >
      <span className="line-clamp-3 min-w-0 break-words text-base font-medium text-foreground lg:text-lg">
        {task.task_name}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {task.season ? <ColorTag label={task.season.season} color={task.season.color} /> : null}
        {task.brand ? <ColorTag label={task.brand.brand_name} color={task.brand.color} /> : null}
        {owners.length > 0 ? (
          <span className="flex min-w-0 max-w-full items-center gap-2 text-sm text-muted-foreground">
            <PartyStack parties={owners} maxVisible={2} showSoleName />
          </span>
        ) : null}
      </div>
    </button>
  );
};

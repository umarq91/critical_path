"use client";

import type { ReactNode } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  CircleDot,
  ClipboardList,
  FileText,
  Flag,
  History,
  Lock,
  Milestone,
  MoreVertical,
  Tag,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/status-badge";
import { ColorTag } from "@/components/shared/color-tag";
import { TaskPeopleSection } from "@/app/(app)/tasks/task-people-section";
import { TASK_STATUS_CONFIG } from "@/constants/task-status";
import { TASK_GENDER_CONFIG } from "@/constants/task-gender";
import { getVizColorForId } from "@/constants/chart-colors";
import { initials } from "@/lib/utils";
import { formatDate } from "@/app/(app)/tasks/columns";
import type { Task } from "@/data/tasks";
import type { LucideIcon } from "lucide-react";

interface TaskDetailDrawerProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canAssignPeople: boolean;
}

function SectionHeading({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Icon className="size-4 text-muted-foreground" />
      {title}
    </h3>
  );
}

function OverviewField({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground italic">{children}</p>;
}

export const TaskDetailDrawer = ({ task, open, onOpenChange, canAssignPeople }: TaskDetailDrawerProps) => {
  if (!task) return null;

  const initialPeople = task.people
    .map((entry) => entry.profile)
    .filter((profile): profile is NonNullable<typeof profile> => profile !== null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="flex w-full flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[460px] data-[side=right]:lg:max-w-[560px] data-[side=right]:xl:max-w-[640px] data-[side=right]:2xl:max-w-[720px]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4">
          <div className="flex min-w-0 flex-col gap-2">
            <SheetTitle className="truncate text-base font-semibold">{task.task_name}</SheetTitle>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={task.status} config={TASK_STATUS_CONFIG} />
              {task.is_locked ? (
                <Badge variant="outline" className="gap-1">
                  <Lock className="size-3" />
                  Locked
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" disabled aria-label="More actions">
              <MoreVertical className="size-4" />
            </Button>
            <SheetClose render={<Button variant="ghost" size="icon-sm" />}>
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-4">
            <SectionHeading icon={ClipboardList} title="Task Overview" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <OverviewField icon={Tag} label="Brand">
                {task.brand?.brand_name ?? "—"}
              </OverviewField>
              <OverviewField icon={CalendarRange} label="Season">
                {task.season ? <ColorTag label={task.season.season_name} color={task.season.color} /> : "—"}
              </OverviewField>
              <OverviewField icon={Milestone} label="Key Stage">
                {task.key_stage?.name ?? <span className="text-muted-foreground">Not set</span>}
              </OverviewField>
              <OverviewField icon={UserCheck} label="Owner / Assignee">
                {task.assignee ? (
                  <span className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarImage src={task.assignee.avatar_url ?? undefined} alt="" />
                      <AvatarFallback
                        className="text-white"
                        style={{ backgroundColor: getVizColorForId(task.assignee.id) }}
                      >
                        {initials(task.assignee.full_name, task.assignee.email)}
                      </AvatarFallback>
                    </Avatar>
                    {task.assignee.full_name ?? task.assignee.email}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </OverviewField>
              <OverviewField icon={CircleDot} label="Status">
                <StatusBadge value={task.status} config={TASK_STATUS_CONFIG} />
              </OverviewField>
              <OverviewField icon={CalendarClock} label="Due Date">
                {formatDate(task.due_date)}
              </OverviewField>
              <OverviewField icon={Flag} label="Priority">
                <span className="text-muted-foreground">Not set</span>
              </OverviewField>
              <OverviewField icon={CalendarPlus} label="Created">
                {formatDate(task.created_at)}
              </OverviewField>
              <OverviewField icon={History} label="Last Updated">
                {formatDate(task.updated_at)}
              </OverviewField>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <SectionHeading icon={FileText} title="Description" />
            {task.notes ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{task.notes}</p>
            ) : (
              <EmptyNote>No description added yet.</EmptyNote>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <SectionHeading icon={Users} title="People Involved" />
            <TaskPeopleSection
              key={task.id}
              taskId={task.id}
              initialPeople={initialPeople}
              canManage={canAssignPeople}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-4">
            <SectionHeading icon={CalendarRange} title="Additional Information" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <OverviewField icon={UserRound} label="Gender">
                <StatusBadge value={task.gender} config={TASK_GENDER_CONFIG} />
              </OverviewField>
              <OverviewField icon={CalendarRange} label="Start Date">
                {task.start_date ? formatDate(task.start_date) : <span className="text-muted-foreground">Not set</span>}
              </OverviewField>
              <OverviewField icon={CalendarCheck} label="Expected Finish">
                {task.end_date ? formatDate(task.end_date) : <span className="text-muted-foreground">Not set</span>}
              </OverviewField>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

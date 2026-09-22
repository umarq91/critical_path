"use client";

import { useState } from "react";
import { NotifyEnabledCard } from "@/app/(app)/settings/notifications/notify-enabled-card";
import { NotifyTasksCard } from "@/app/(app)/settings/notifications/notify-tasks-card";
import { NotifyTimingCard } from "@/app/(app)/settings/notifications/notify-timing-card";
import type { FilterSelectOption } from "@/components/shared/filter-select";
import type { ReminderRule, ReminderRuleTask } from "@/data/reminders";

interface NotificationsConfigProps {
  initialIsEnabled: boolean;
  initialTasks: ReminderRuleTask[];
  initialRule: ReminderRule | null;
  seasonOptions: FilterSelectOption[];
  ownerOptions: FilterSelectOption[];
  brandOptions: FilterSelectOption[];
  genderOptions: FilterSelectOption[];
  timezoneLabel: string;
}

// Owns the on/off state client-side so Step 1 and Step 2 can dim/undim instantly on toggle,
// without a round trip — NotifyEnabledCard still persists the flag itself (see its own comment),
// this component only mirrors it to decide the `disabled` prop passed down. Both step cards stay
// mounted and visible even when off (see their own `disabled` prop) rather than being hidden —
// seeing what Step 1/2 involve, just grayed out, orients a first-time visitor better than an
// empty placeholder would.
export const NotificationsConfig = ({
  initialIsEnabled,
  initialTasks,
  initialRule,
  seasonOptions,
  ownerOptions,
  brandOptions,
  genderOptions,
  timezoneLabel,
}: NotificationsConfigProps) => {
  const [isEnabled, setIsEnabled] = useState(initialIsEnabled);
  const hasSelectedTasks = initialTasks.length > 0;

  return (
    <>
      <NotifyEnabledCard initialIsEnabled={initialIsEnabled} onChange={setIsEnabled} />
      <NotifyTasksCard
        initialTasks={initialTasks}
        seasonOptions={seasonOptions}
        ownerOptions={ownerOptions}
        brandOptions={brandOptions}
        genderOptions={genderOptions}
        disabled={!isEnabled}
      />
      <NotifyTimingCard
        initialRule={initialRule}
        hasSelectedTasks={hasSelectedTasks}
        timezoneLabel={timezoneLabel}
        disabled={!isEnabled}
      />
    </>
  );
};

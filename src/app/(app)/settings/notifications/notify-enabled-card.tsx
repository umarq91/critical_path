"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updateReminderEnabled } from "@/app/(app)/settings/notifications/_reminder-actions";

interface NotifyEnabledCardProps {
  initialIsEnabled: boolean;
  onChange: (isEnabled: boolean) => void;
}

// Sits above Step 1 and Step 2, gating both — see notify-tasks-card.tsx / notify-timing-card.tsx's
// `disabled` prop. Saves immediately on toggle (no separate Save button) since it's a single
// boolean, unlike the multi-field cards below it.
export const NotifyEnabledCard = ({ initialIsEnabled, onChange }: NotifyEnabledCardProps) => {
  const [isEnabled, setIsEnabled] = useState(initialIsEnabled);
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggle(checked: boolean) {
    setIsEnabled(checked);
    onChange(checked);
    setIsSaving(true);
    const result = await updateReminderEnabled({ isEnabled: checked });
    setIsSaving(false);

    if (!result.ok) {
      setIsEnabled(!checked);
      onChange(!checked);
      toast.error(result.error);
      return;
    }
    toast.success(checked ? "Email reminders turned on" : "Email reminders turned off");
  }

  return (
    <Card className="lg:col-span-2">
      <CardContent className="flex items-center gap-3 py-(--card-spacing)">
        <Checkbox checked={isEnabled} disabled={isSaving} onCheckedChange={(checked) => handleToggle(!!checked)} />
        <div className="flex flex-col gap-0.5">
          <Label className="cursor-pointer text-base font-medium text-foreground" onClick={() => !isSaving && handleToggle(!isEnabled)}>
            Email reminders
          </Label>
          <p className="text-sm text-muted-foreground">
            Turn this on to set up which tasks you get emailed about and when. Turning it off pauses everything
            below without losing your saved tasks or timing.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

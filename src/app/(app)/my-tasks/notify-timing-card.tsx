"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  REMINDER_OFFSET_PRESETS,
  REMINDER_HOUR_OPTIONS,
  reminderTimingSchema,
} from "@/app/(app)/my-tasks/reminder-schema";
import { updateReminderTiming } from "@/app/(app)/my-tasks/_reminder-actions";
import type { ReminderRule } from "@/data/reminders";

function hourLabel(hour: number) {
  const period = hour < 12 ? "AM" : "PM";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:00 ${period}`;
}

interface NotifyTimingCardProps {
  initialRule: ReminderRule | null;
}

// "Notify me" — the reminder's timing: which day-offsets before due_date to send at, and what
// hour of day. Offsets are a single `offsetDays` number[] (see reminder_rules.offset_days) —
// the three presets and any custom value the user adds are all just entries in that one array,
// not structurally different from each other.
//
// Plain useState rather than react-hook-form: every field here is a custom widget (checkbox
// group, chip list, a Select) with nothing resembling a registered <input>, so RHF would add a
// dependency without buying anything — validation is one reminderTimingSchema.safeParse() call
// on submit instead.
export const NotifyTimingCard = ({ initialRule }: NotifyTimingCardProps) => {
  const [offsetDays, setOffsetDays] = useState<number[]>(initialRule?.offsetDays ?? []);
  const [notifyHour, setNotifyHour] = useState(initialRule?.notifyHour ?? 9);
  const [isEnabled, setIsEnabled] = useState(initialRule?.isEnabled ?? true);
  const [customInput, setCustomInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const presetValues = new Set<number>(REMINDER_OFFSET_PRESETS.map((preset) => preset.value));
  const customOffsets = offsetDays.filter((value) => !presetValues.has(value)).sort((a, b) => a - b);

  function togglePreset(value: number) {
    setOffsetDays((current) => (current.includes(value) ? current.filter((day) => day !== value) : [...current, value]));
  }

  function addCustomOffset() {
    const days = Number(customInput);
    if (!Number.isInteger(days) || days < 1) {
      toast.error("Enter a whole number of days");
      return;
    }
    setOffsetDays((current) => (current.includes(days) ? current : [...current, days]));
    setCustomInput("");
  }

  function removeOffset(value: number) {
    setOffsetDays((current) => current.filter((day) => day !== value));
  }

  async function handleSave() {
    const parsed = reminderTimingSchema.safeParse({ offsetDays, notifyHour, isEnabled });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setError(null);

    setIsSaving(true);
    const result = await updateReminderTiming(parsed.data);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Reminder timing saved");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notify me</CardTitle>
        <CardDescription>Choose when to get an email reminder before a task&apos;s due date.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={isEnabled} onCheckedChange={(checked) => setIsEnabled(!!checked)} />
          <Label className="cursor-pointer font-normal">Reminders on</Label>
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">When</span>
          <div className="flex flex-wrap gap-4">
            {REMINDER_OFFSET_PRESETS.map((preset) => (
              <label key={preset.value} className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={offsetDays.includes(preset.value)} onCheckedChange={() => togglePreset(preset.value)} />
                <span className="cursor-pointer font-normal" onClick={() => togglePreset(preset.value)}>
                  {preset.label}
                </span>
              </label>
            ))}
          </div>

          {customOffsets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {customOffsets.map((value) => (
                <span
                  key={value}
                  className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                >
                  {value} days before
                  <button type="button" onClick={() => removeOffset(value)} aria-label={`Remove ${value} days before`}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <Input
              value={customInput}
              onChange={(event) => setCustomInput(event.target.value)}
              placeholder="Custom (days)"
              inputMode="numeric"
              className="h-8 w-36"
            />
            <Button type="button" variant="outline" size="sm" onClick={addCustomOffset}>
              Add
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Send at</span>
          <Select value={String(notifyHour)} onValueChange={(value: string | null) => value && setNotifyHour(Number(value))}>
            <SelectTrigger className="w-40">
              <SelectValue>{(value: string) => hourLabel(Number(value))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REMINDER_HOUR_OPTIONS.map((hour) => (
                <SelectItem key={hour} value={String(hour)}>
                  {hourLabel(hour)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="button" onClick={handleSave} disabled={isSaving} className="self-start">
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
};

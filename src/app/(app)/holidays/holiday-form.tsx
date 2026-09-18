"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { TextareaField } from "@/components/form-fields/textarea-field";
import { DateField } from "@/components/form-fields/date-field";
import { holidaySchema, type HolidayInput } from "@/app/(app)/holidays/schema";
import { createHoliday, updateHoliday } from "@/app/(app)/holidays/_actions";
import { KNOWN_HOLIDAY_COUNTRIES } from "@/constants/holiday-country";
import type { Holiday } from "@/data/holidays";

interface HolidayFormProps {
  onSuccess: () => void;
  /** Present when editing an existing holiday; absent for a new one. */
  holiday?: Holiday;
}

export const HolidayForm = ({ onSuccess, holiday }: HolidayFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!holiday;
  const form = useForm<HolidayInput>({
    resolver: zodResolver(holidaySchema),
    defaultValues: {
      country: holiday?.country ?? "",
      holiday_date: holiday?.holiday_date ?? "",
      name: holiday?.name ?? "",
      description: holiday?.description ?? "",
    },
  });

  async function onSubmit(input: HolidayInput) {
    setIsSubmitting(true);
    const result = isEditing ? await updateHoliday(holiday.id, input) : await createHoliday(input);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(isEditing ? `${input.name} updated` : `${input.name} added`);
    form.reset();
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <DateField control={form.control} name="holiday_date" label="Date" />
        <TextField control={form.control} name="name" label="Event Name" placeholder="Australia Day" />
        <TextareaField
          control={form.control}
          name="description"
          label="Description"
          placeholder="Optional notes about this holiday"
        />
        <div className="flex flex-col gap-1.5">
          <TextField control={form.control} name="country" label="Country" placeholder="AU" />
          {/* Quick picks fill the field above rather than replacing it — country is open text
              (public_holidays.country has no fixed list, see 0027_public_holidays.sql), so
              typing a country not in this row is just as valid as clicking one. */}
          <div className="flex flex-wrap gap-1.5">
            {KNOWN_HOLIDAY_COUNTRIES.map((option) => (
              <Button
                key={option.code}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => form.setValue("country", option.code, { shouldValidate: true })}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={isSubmitting} className="mt-2">
          {isSubmitting ? "Saving…" : isEditing ? "Save Changes" : "Add Holiday"}
        </Button>
      </form>
    </Form>
  );
};

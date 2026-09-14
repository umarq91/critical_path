"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Copy, Check, TriangleAlert, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { TextField } from "@/components/form-fields/text-field";
import { FormDialog } from "@/components/shared/form-dialog";
import { apiKeyCreateSchema, type ApiKeyCreateInput } from "@/app/(app)/management/integrations/schema";
import { createApiKey } from "@/app/(app)/management/integrations/_actions";

// The one genuinely new interaction in this feature: every other admin entity's create dialog
// is a single step (fill form, submit, closed). This is two, because the raw key can only ever
// be shown once — there is nothing in the database to re-display it from afterward (only its
// hash is stored). "form" collects the name; "reveal" shows the one-time secret and nothing
// else is interactive except copy/done.
type Step = { kind: "form" } | { kind: "reveal"; name: string; rawKey: string };

export const CreateApiKeyDialog = () => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const form = useForm<ApiKeyCreateInput>({
    resolver: zodResolver(apiKeyCreateSchema),
    defaultValues: { name: "" },
  });

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      // Reset only on close, not on the form→reveal transition — the dialog itself stays
      // open across that step.
      setStep({ kind: "form" });
      setCopied(false);
      form.reset();
    }
  }

  async function onSubmit(input: ApiKeyCreateInput) {
    setIsSubmitting(true);
    const result = await createApiKey(input);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setStep({ kind: "reveal", name: result.data.name, rawKey: result.data.rawKey });
  }

  async function handleCopy(rawKey: string) {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    toast.success("Copied to clipboard");
  }

  return (
    <FormDialog
      title={step.kind === "form" ? "Create API Key" : "Copy your key"}
      description={
        step.kind === "form"
          ? "Name it after the system that will use it — you can create more than one."
          : undefined
      }
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button>
          <Plus />
          Create API Key
        </Button>
      }
    >
      {step.kind === "form" ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <TextField control={form.control} name="name" label="Name" placeholder="Databricks — Production" />
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "Creating…" : "Create Key"}
            </Button>
          </form>
        </Form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-lg border border-status-overdue-base bg-status-overdue-soft px-3 py-2.5 text-sm text-status-overdue-text">
            <TriangleAlert className="size-4 shrink-0 translate-y-0.5" />
            <span>
              This is the only time &ldquo;{step.name}&rdquo;&apos;s key is shown. Copy it now — it can&apos;t be
              retrieved again, only revoked and reissued.
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2.5">
            <code className="min-w-0 flex-1 truncate text-sm text-foreground">{step.rawKey}</code>
            <Button type="button" variant="outline" size="icon-sm" onClick={() => handleCopy(step.rawKey)} aria-label="Copy key">
              {copied ? <Check className="text-status-complete-text" /> : <Copy />}
            </Button>
          </div>
          <Button type="button" onClick={() => handleOpenChange(false)} className="w-full">
            Done
          </Button>
        </div>
      )}
    </FormDialog>
  );
};

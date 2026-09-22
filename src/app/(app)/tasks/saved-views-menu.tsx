"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TextField } from "@/components/form-fields/text-field";
import { dataTableSearchParamsHref } from "@/components/data-table/data-table-search-params";
import { createSavedView, deleteSavedView } from "@/app/(app)/tasks/_saved-view-actions";
import { savedViewNameSchema, type SavedViewNameInput } from "@/app/(app)/tasks/saved-view-schema";
import { TASKS_QUERY_STATE } from "@/app/(app)/tasks/query-state";
import type { SavedView } from "@/data/saved-views";

interface SavedViewsMenuProps {
  savedViews: SavedView[];
  currentFilters: Record<string, string>;
  currentSortBy?: string;
  currentSortDir?: string;
}

// "Views" — save the grid's current filter/sort combination (read straight off the URL, the
// same {filters, sortBy, sortDir} shape data-table-search-params.ts already owns) under a name,
// and jump back to it later. Applying a view is a plain navigation built by
// dataTableSearchParamsHref — the same helper that builds e.g. the Dashboard's Overdue tile
// link — so there's no second "apply a view" code path to keep in step with normal filtering.
export const SavedViewsMenu = ({ savedViews, currentFilters, currentSortBy, currentSortDir }: SavedViewsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedView | null>(null);

  const hasActiveState = Object.keys(currentFilters).length > 0 || !!currentSortBy;

  const form = useForm<SavedViewNameInput>({
    resolver: zodResolver(savedViewNameSchema),
    defaultValues: { name: "" },
  });

  async function handleSave(input: SavedViewNameInput) {
    setIsSaving(true);
    const result = await createSavedView({
      name: input.name,
      filters: currentFilters,
      sortBy: currentSortBy,
      sortDir: currentSortDir,
    });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${input.name}" saved`);
    form.reset({ name: "" });
  }

  async function handleDelete(view: SavedView) {
    const result = await deleteSavedView(view.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${view.name}" removed`);
  }

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger render={<Button variant="outline" className="gap-1.5" />}>
          <Bookmark />
          Views
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Saved views</span>
              {savedViews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved views yet.</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {savedViews.map((view) => (
                    <div key={view.id} className="flex items-center gap-1 rounded-md hover:bg-muted">
                      <Link
                        href={dataTableSearchParamsHref(
                          "/tasks",
                          { filters: view.filters, sortBy: view.sortBy ?? undefined, sortDir: view.sortDir ?? undefined },
                          TASKS_QUERY_STATE
                        )}
                        onClick={() => setIsOpen(false)}
                        className="min-w-0 flex-1 truncate px-2 py-1.5 text-sm text-foreground"
                      >
                        {view.name}
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${view.name}`}
                        onClick={() => setPendingDelete(view)}
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSave)} className="flex flex-col gap-3">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Save current filters
                </span>
                <TextField control={form.control} name="name" label="Name" placeholder="e.g. Overdue Winter tasks" />
                <Button type="submit" size="sm" disabled={isSaving || !hasActiveState} className="self-start">
                  {isSaving ? "Saving…" : "Save view"}
                </Button>
                {!hasActiveState ? (
                  <p className="text-xs text-muted-foreground">Apply at least one filter or sort to save a view.</p>
                ) : null}
              </form>
            </Form>
          </div>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        title="Delete saved view"
        description={
          pendingDelete ? `This removes "${pendingDelete.name}". It can be recreated later with the same filters.` : undefined
        }
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await handleDelete(pendingDelete);
        }}
      />
    </>
  );
};

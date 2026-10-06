"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { Bookmark, Check, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TextField } from "@/components/form-fields/text-field";
import { createSavedView, deleteSavedView, updateSavedView } from "@/app/(app)/tasks/_saved-view-actions";
import { savedViewNameSchema, type SavedViewNameInput } from "@/app/(app)/tasks/saved-view-schema";
import { resolveActiveView, savedViewHref } from "@/app/(app)/tasks/saved-view-match";
import { cn } from "@/lib/utils";
import { ROUTES, SAVED_VIEW_PARAM } from "@/constants/routes";
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
// That link also carries `?view=<id>`, which is how the trigger names the selected view and
// knows to offer "Update" once the grid's filters drift from what the view stored. Deselecting
// (the ✕, or clicking the selected view again) goes back to the plain, unfiltered grid.
export const SavedViewsMenu = ({ savedViews, currentFilters, currentSortBy, currentSortDir }: SavedViewsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedView | null>(null);
  const [viewParam, setViewParam] = useQueryState(SAVED_VIEW_PARAM);

  const currentState = {
    filters: currentFilters,
    sortBy: currentSortBy,
    sortDir: currentSortDir,
  };
  const active = resolveActiveView(savedViews, viewParam, currentState);

  const hasActiveState = Object.keys(currentFilters).length > 0 || !!currentSortBy;

  const form = useForm<SavedViewNameInput>({
    resolver: zodResolver(savedViewNameSchema),
    defaultValues: { name: "" },
  });

  async function handleSave(input: SavedViewNameInput) {
    setIsSaving(true);
    const result = await createSavedView({ name: input.name, ...currentState });
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${input.name}" saved`);
    form.reset({ name: "" });
    void setViewParam(result.data.id);
  }

  async function handleUpdate(view: SavedView) {
    setIsSaving(true);
    const result = await updateSavedView(view.id, currentState);
    setIsSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${view.name}" updated`);
    void setViewParam(view.id);
  }

  async function handleDelete(view: SavedView) {
    const result = await deleteSavedView(view.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${view.name}" removed`);
    if (view.id === active?.view.id) void setViewParam(null);
  }

  return (
    <>
      <div className="flex items-center">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger
            render={
              <Button
                variant={active ? "secondary" : "outline"}
                className={cn("max-w-64 gap-1.5", active && "rounded-r-none")}
              />
            }
          >
            <Bookmark className={cn(active && "fill-current")} />
            <span className="truncate">{active ? active.view.name : "Views"}</span>
            {active?.isModified ? <span className="shrink-0 font-normal text-muted-foreground">(edited)</span> : null}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-3">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Saved views</span>
                {savedViews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved views yet.</p>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {savedViews.map((view) => {
                      const isActive = view.id === active?.view.id;
                      return (
                        <div
                          key={view.id}
                          className={cn(
                            "flex items-center gap-1 rounded-md hover:bg-muted",
                            isActive && "bg-primary-tint"
                          )}
                        >
                          <Link
                            href={isActive ? ROUTES.tasks : savedViewHref(view)}
                            onClick={() => setIsOpen(false)}
                            aria-current={isActive ? "true" : undefined}
                            title={isActive ? "Click to deselect this view" : undefined}
                            className={cn(
                              "flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-sm text-foreground",
                              isActive && "font-medium text-primary"
                            )}
                          >
                            <Check className={cn("size-3.5 shrink-0", !isActive && "invisible")} />
                            <span className="truncate">{view.name}</span>
                            {isActive && active.isModified ? (
                              <span className="shrink-0 text-xs font-normal text-muted-foreground">edited</span>
                            ) : null}
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
                      );
                    })}
                  </div>
                )}
              </div>

              {active?.isModified ? (
                <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-muted p-2.5">
                  <p className="text-xs text-muted-foreground">
                    Filters have changed since &ldquo;{active.view.name}&rdquo; was applied.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={isSaving} onClick={() => handleUpdate(active.view)}>
                      {isSaving ? "Updating…" : "Update view"}
                    </Button>
                    <Link
                      href={savedViewHref(active.view)}
                      onClick={() => setIsOpen(false)}
                      className={buttonVariants({ size: "sm", variant: "ghost" })}
                    >
                      Revert
                    </Link>
                  </div>
                </div>
              ) : null}

              <Separator />

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSave)} className="flex flex-col gap-3">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Save current filters as new view
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
        {active ? (
          <Link
            href={ROUTES.tasks}
            aria-label={`Deselect ${active.view.name}`}
            title="Deselect view"
            className={cn(
              buttonVariants({ variant: "secondary", size: "icon" }),
              "rounded-l-none border-l border-l-border-subtle"
            )}
          >
            <X />
          </Link>
        ) : null}
      </div>

      <ConfirmDialog
        title="Delete saved view"
        description={
          pendingDelete
            ? `This removes "${pendingDelete.name}". It can be recreated later with the same filters.`
            : undefined
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

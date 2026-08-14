import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function NavSearch() {
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search anything..."
        className="h-9 pr-14 pl-8"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">
        Ctrl K
      </kbd>
    </div>
  );
}

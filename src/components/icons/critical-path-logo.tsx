import { Asterisk } from "lucide-react";
import { cn } from "@/lib/utils";

export function CriticalPathLogo({ className }: { className?: string }) {
  return <Asterisk className={cn("text-primary", className)} aria-hidden="true" />;
}

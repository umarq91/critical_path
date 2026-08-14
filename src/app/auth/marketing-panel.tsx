import { CheckCircle2, Users, BarChart3 } from "lucide-react";
import { CriticalPathLogo } from "@/components/icons/critical-path-logo";

const FEATURES = [
  {
    icon: CheckCircle2,
    iconClassName: "bg-primary",
    title: "Organise Tasks",
    description: "Keep everything in one place.",
  },
  {
    icon: Users,
    iconClassName: "bg-accent-teal",
    title: "Collaborate",
    description: "Work together with your team.",
  },
  {
    icon: BarChart3,
    iconClassName: "bg-status-progress-base",
    title: "Track Progress",
    description: "Monitor and achieve your goals.",
  },
];

export function MarketingPanel() {
  return (
    <div className="flex h-full flex-col justify-between p-16 xl:p-20">
      <div className="flex items-center gap-3">
        <CriticalPathLogo className="size-8 shrink-0" />
        <span className="text-2xl font-semibold text-foreground">Critical Path</span>
      </div>

      <div className="flex flex-col gap-4">
        <h1 className="text-5xl leading-tight font-bold text-foreground xl:text-6xl">
          Plan. Track. Complete.
        </h1>
        <p className="max-w-md text-lg text-text-secondary xl:text-xl">
          Streamline your workflow, manage tasks and deliver results efficiently.
        </p>
      </div>

      <div className="flex flex-wrap gap-10">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="flex items-start gap-3">
            <div
              className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${feature.iconClassName}`}
            >
              <feature.icon className="size-6 text-text-inverse" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-semibold text-foreground">{feature.title}</span>
              <span className="text-sm text-muted-foreground">{feature.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

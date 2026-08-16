import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-h1 text-foreground">{title}</h1>
        {description ? <p className="text-body text-text-secondary">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-6 py-5">
      <h1 className="text-h1 text-foreground">{title}</h1>
      {description ? <p className="text-body text-text-secondary">{description}</p> : null}
    </div>
  );
}

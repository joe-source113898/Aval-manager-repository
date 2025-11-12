"use client";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">En construcción</p>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description ? <p className="mx-auto max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

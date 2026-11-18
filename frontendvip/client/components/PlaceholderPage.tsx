import { Hammer } from "lucide-react";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-dashed border-border bg-white p-10 text-center shadow-card">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
          <Hammer className="size-5" />
        </span>
        <h2 className="mt-5 text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This page is a placeholder. Keep prompting to describe what it should
          contain and it will be built out next.
        </p>
      </div>
    </div>
  );
}

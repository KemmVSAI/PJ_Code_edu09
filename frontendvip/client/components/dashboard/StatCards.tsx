import type { LucideIcon } from "lucide-react";

export interface StatItem {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
}

export function StatCards({ stats }: { stats: StatItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, hint, icon: Icon }) => (
        <div
          key={label}
          className="rounded-xl border border-border bg-white p-5 shadow-card"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
              <Icon className="size-[18px]" />
            </span>
          </div>
          <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {value.toLocaleString("en-US")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
      ))}
    </div>
  );
}

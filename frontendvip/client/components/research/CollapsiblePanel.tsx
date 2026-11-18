import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CollapsiblePanelProps {
  side: "left" | "right";
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}

export function CollapsiblePanel({
  side,
  title,
  open,
  onOpenChange,
  className,
  children,
}: CollapsiblePanelProps) {
  const isLeft = side === "left";
  const CollapseIcon = isLeft ? ChevronLeft : ChevronRight;
  const borderClass = isLeft ? "border-r" : "border-l";

  if (!open) {
    return (
      <aside
        aria-label={title}
        className={cn(
          "flex w-14 shrink-0 flex-col items-center gap-4 border-border bg-white py-4",
          borderClass,
          className,
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(true)}
          aria-label={`Expand ${title}`}
        >
          {isLeft ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
          {title}
        </span>
      </aside>
    );
  }

  return (
    <aside
      aria-label={title}
      className={cn(
        "flex w-72 shrink-0 flex-col border-border bg-white",
        borderClass,
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => onOpenChange(false)}
          aria-label={`Collapse ${title}`}
        >
          <CollapseIcon className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}

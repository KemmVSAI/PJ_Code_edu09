import type { PaperDecision } from "@/lib/research-papers";
import { cn } from "@/lib/utils";

import { DECISION_BUTTON_STYLES, DECISION_LABELS } from "./research-ui";

const DECISIONS: PaperDecision[] = ["include", "exclude", "maybe"];

interface DecisionButtonsProps {
  paperTitle: string;
  value?: PaperDecision;
  onChange: (decision: PaperDecision) => void;
  className?: string;
}

export function DecisionButtons({
  paperTitle,
  value,
  onChange,
  className,
}: DecisionButtonsProps) {
  return (
    <div
      role="group"
      aria-label={`Screening decision for ${paperTitle}`}
      className={cn("grid grid-cols-3 gap-2", className)}
    >
      {DECISIONS.map((decision) => (
        <button
          key={decision}
          type="button"
          aria-pressed={value === decision}
          onClick={() => onChange(decision)}
          className={cn(
            "h-8 rounded-lg border border-input bg-white px-2 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
            DECISION_BUTTON_STYLES[decision],
          )}
        >
          {DECISION_LABELS[decision]}
        </button>
      ))}
    </div>
  );
}

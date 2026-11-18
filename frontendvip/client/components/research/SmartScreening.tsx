import { ListChecks, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { PaperDecision } from "@/lib/research-papers";

import { DecisionButtons } from "./DecisionButtons";
import {
  DECISION_BADGE_STYLES,
  DECISION_LABELS,
  scoreBarTone,
} from "./research-ui";
import type { ResearchWorkspace } from "./use-research-workspace";

type ScreeningFilter = "all" | "pending" | PaperDecision;

const FILTERS: { value: ScreeningFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "include", label: "Include" },
  { value: "exclude", label: "Exclude" },
  { value: "maybe", label: "Maybe" },
];

interface SmartScreeningProps {
  workspace: ResearchWorkspace;
  onSelectPaper: (id: string) => void;
  onGoToSearch: () => void;
}

export function SmartScreening({
  workspace,
  onSelectPaper,
  onGoToSearch,
}: SmartScreeningProps) {
  const { collectedPapers, decisions, setDecision } = workspace;
  const [filter, setFilter] = useState<ScreeningFilter>("all");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const ranked = useMemo(
    () => [...collectedPapers].sort((a, b) => b.relevance - a.relevance),
    [collectedPapers],
  );

  const countFor = (value: ScreeningFilter) =>
    ranked.filter((paper) => {
      if (value === "all") return true;
      if (value === "pending") return !decisions[paper.id];
      return decisions[paper.id] === value;
    }).length;

  const total = ranked.length;
  const decidedCount = total - countFor("pending");
  const visible = ranked.filter((paper) => {
    if (filter === "all") return true;
    if (filter === "pending") return !decisions[paper.id];
    return decisions[paper.id] === filter;
  });

  const toggleAbstract = (id: string) =>
    setExpandedIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );

  if (total === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-dashed border-border bg-white p-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
            <ListChecks className="size-5" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            No papers to screen yet
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Add papers from Academic search. Each one will be scored for
            relevance and receive an AI recommendation.
          </p>
          <Button className="mt-6" onClick={onGoToSearch}>
            Go to academic search
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-4 border-b border-border bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Smart screening
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Review AI relevance scores and recommendations, then record your
              decision for each paper.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>Screened</span>
              <span className="font-semibold tabular-nums text-foreground">
                {decidedCount} of {total}
              </span>
            </div>
            <Progress
              value={(decidedCount / total) * 100}
              aria-label="Screening progress"
              className="mt-2 h-2 bg-slate-100"
            />
          </div>
        </div>

        <div
          role="group"
          aria-label="Filter by decision"
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-white text-slate-700 hover:bg-accent",
              )}
            >
              {label}{" "}
              <span className="tabular-nums opacity-75">{countFor(value)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 p-5">
        {visible.length === 0 ? (
          <div className="mx-auto max-w-md rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted-foreground">
            {filter === "pending"
              ? "Every paper has a decision. Nice work."
              : "No papers are in this group yet."}
          </div>
        ) : (
          <ul className="mx-auto max-w-5xl divide-y divide-border overflow-hidden rounded-xl border border-border bg-white shadow-card">
            {visible.map((paper) => {
              const decision = decisions[paper.id];
              const isExpanded = expandedIds.includes(paper.id);
              return (
                <li
                  key={paper.id}
                  className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_220px]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {paper.venue} · {paper.year}
                      </span>
                      {decision && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset",
                            DECISION_BADGE_STYLES[decision],
                          )}
                        >
                          {DECISION_LABELS[decision]}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectPaper(paper.id)}
                      className="mt-1.5 text-left text-base font-semibold leading-snug text-foreground hover:text-primary"
                    >
                      {paper.title}
                    </button>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {paper.authors.join(", ")}
                    </p>

                    <p
                      className={cn(
                        "mt-3 text-sm leading-relaxed text-slate-600",
                        !isExpanded && "line-clamp-2",
                      )}
                    >
                      {paper.abstract}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleAbstract(paper.id)}
                      aria-expanded={isExpanded}
                      className="mt-1 text-xs font-medium text-primary hover:underline"
                    >
                      {isExpanded ? "Hide abstract" : "Show abstract"}
                    </button>

                    <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <Sparkles className="size-3.5" />
                        AI suggests {DECISION_LABELS[paper.aiRecommendation]}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {paper.aiRationale}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 lg:border-l lg:border-border lg:pl-5">
                    <div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">
                          Relevance score
                        </span>
                        <span className="text-lg font-semibold tabular-nums text-foreground">
                          {paper.relevance}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            scoreBarTone(paper.relevance),
                          )}
                          style={{ width: `${paper.relevance}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Your decision
                      </p>
                      <DecisionButtons
                        paperTitle={paper.title}
                        value={decision}
                        onChange={(next) => setDecision(paper.id, next)}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

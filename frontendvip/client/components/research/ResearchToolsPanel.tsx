import {
  FileDown,
  FileText,
  ListChecks,
  MessageSquareText,
  Quote,
  Search,
  Table2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { DECISION_BADGE_STYLES, DECISION_LABELS } from "./research-ui";
import type {
  ResearchWorkspace,
  WorkspaceView,
} from "./use-research-workspace";

interface ResearchToolsPanelProps {
  workspace: ResearchWorkspace;
  onSelectPaper: (id: string) => void;
  onNavigate?: () => void;
}

const TOOLS: { view: WorkspaceView; label: string; icon: typeof Search }[] = [
  { view: "search", label: "Academic search", icon: Search },
  { view: "screening", label: "Smart screening", icon: ListChecks },
  { view: "chat", label: "Assistant", icon: MessageSquareText },
  { view: "summary", label: "Paper summaries", icon: FileText },
  { view: "evidence", label: "Evidence RAG", icon: Quote },
  { view: "matrix", label: "Comparison matrix", icon: Table2 },
];

const TOOL_DETAILS: Partial<Record<WorkspaceView, string>> = {
  summary: "Structured field extraction",
  evidence: "Cited answers from selected papers",
  matrix: "Compare papers side by side",
};

export function ResearchToolsPanel({
  workspace,
  onSelectPaper,
  onNavigate,
}: ResearchToolsPanelProps) {
  const {
    view,
    setView,
    collectedPapers,
    selectedIds,
    decisions,
    activePaper,
    toggleSelected,
    removeFromSession,
    searchHistory,
    clearSearchHistory,
    runSearch,
  } = workspace;

  const decidedCount = collectedPapers.filter(
    (paper) => decisions[paper.id],
  ).length;
  const selectedCount = collectedPapers.filter((paper) =>
    selectedIds.includes(paper.id),
  ).length;

  const navigateTo = (next: WorkspaceView) => {
    setView(next);
    onNavigate?.();
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <section aria-labelledby="research-tools-heading">
        <h3
          id="research-tools-heading"
          className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Research tools
        </h3>
        <div className="mt-2 flex flex-col gap-1">
          {TOOLS.map(({ view: target, label, icon: Icon }) => {
            const detail =
              target === "screening"
                ? `${decidedCount} of ${collectedPapers.length} decided`
                : target === "chat"
                  ? `${selectedCount} papers in context`
                  : (TOOL_DETAILS[target] ?? "Find and filter papers");
            return (
              <button
                key={target}
                type="button"
                onClick={() => navigateTo(target)}
                aria-current={view === target ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent",
                  view === target && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    view === target
                      ? "bg-primary text-primary-foreground"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {detail}
                  </span>
                </span>
              </button>
            );
          })}
          <Link
            to="/review-export"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <FileDown className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Review & Export
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Build the final output
              </span>
            </span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="collected-heading">
        <div className="flex items-baseline justify-between px-1">
          <h3
            id="collected-heading"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Collected papers
          </h3>
          <span className="text-xs text-muted-foreground">
            {selectedCount} of {collectedPapers.length} selected
          </span>
        </div>

        {collectedPapers.length === 0 ? (
          <div className="mt-2 rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm font-medium text-foreground">
              No papers collected yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add results from Academic search to build this session.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => navigateTo("search")}
            >
              Open academic search
            </Button>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {collectedPapers.map((paper) => {
              const decision = decisions[paper.id];
              const isActive = activePaper?.id === paper.id;
              return (
                <li
                  key={paper.id}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60",
                    isActive && "bg-accent",
                  )}
                >
                  <Checkbox
                    className="mt-1"
                    checked={selectedIds.includes(paper.id)}
                    onCheckedChange={() => toggleSelected(paper.id)}
                    aria-label={`Use ${paper.title} in chat`}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectPaper(paper.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground hover:text-primary">
                      {paper.title}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {paper.year}
                      {decision && (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-px text-[11px] font-semibold ring-1 ring-inset",
                            DECISION_BADGE_STYLES[decision],
                          )}
                        >
                          {DECISION_LABELS[decision]}
                        </span>
                      )}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={() => removeFromSession(paper.id)}
                    aria-label={`Remove ${paper.title} from session`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-heading">
        <div className="flex items-center justify-between px-1">
          <h3
            id="history-heading"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Search history
          </h3>
          {searchHistory.length > 0 && (
            <button
              type="button"
              onClick={clearSearchHistory}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {searchHistory.length === 0 ? (
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Searches you run will appear here.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {searchHistory.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    runSearch(entry.form);
                    onNavigate?.();
                  }}
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <span className="truncate text-sm font-medium text-foreground">
                    {entry.form.query || "All papers"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.resultCount} results · {entry.ranAt}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

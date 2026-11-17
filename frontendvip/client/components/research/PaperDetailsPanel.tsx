import {
  BookOpenText,
  Check,
  MessageSquareText,
  Plus,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  scoreBarTone,
  DECISION_BADGE_STYLES,
  DECISION_LABELS,
} from "./research-ui";
import { cn } from "@/lib/utils";

import { DecisionButtons } from "./DecisionButtons";
import type { ResearchWorkspace } from "./use-research-workspace";

interface PaperDetailsPanelProps {
  workspace: ResearchWorkspace;
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PaperDetailsPanel({ workspace }: PaperDetailsPanelProps) {
  const {
    activePaper,
    collectedPapers,
    decisions,
    setDecision,
    toggleCollected,
    askAboutPaper,
  } = workspace;

  if (!activePaper) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
          <BookOpenText className="size-5" />
        </span>
        <h3 className="mt-4 text-sm font-semibold text-foreground">
          No paper selected
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Choose a paper from search results, your collected list, or a source
          in the conversation to review its metadata and evidence.
        </p>
      </div>
    );
  }

  const paper = activePaper;
  const inSession = collectedPapers.some((item) => item.id === paper.id);
  const decision = decisions[paper.id];

  return (
    <div className="space-y-6 p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-indigo-200 bg-indigo-50 text-indigo-700"
          >
            {paper.domain}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {paper.year} · {paper.venue}
          </span>
        </div>
        <h2 className="mt-3 text-base font-semibold leading-snug text-foreground">
          {paper.title}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {paper.authors.join(", ")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={inSession ? "outline" : "default"}
          onClick={() => toggleCollected(paper.id)}
        >
          {inSession ? (
            <Check className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {inSession ? "In session" : "Add to session"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => askAboutPaper(paper)}
        >
          <MessageSquareText className="size-4" />
          Ask assistant
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-slate-50/70 p-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Citations</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {paper.citations}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Relevance</dt>
          <dd className="flex items-center gap-2 font-medium tabular-nums text-foreground">
            {paper.relevance}
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
              <span
                className={cn(
                  "block h-full rounded-full",
                  scoreBarTone(paper.relevance),
                )}
                style={{ width: `${paper.relevance}%` }}
              />
            </span>
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted-foreground">DOI</dt>
          <dd className="truncate font-mono text-xs text-foreground">
            {paper.doi}
          </dd>
        </div>
      </dl>

      <DetailSection title="Key finding">
        <p className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-sm leading-relaxed text-foreground">
          {paper.keyFinding}
        </p>
      </DetailSection>

      <DetailSection title="Supporting evidence">
        <ul className="space-y-3">
          {paper.evidence.map((item) => (
            <li
              key={item.quote}
              className="rounded-lg border-l-2 border-primary bg-white py-1 pl-3"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {item.section}
              </p>
              <blockquote className="mt-1 text-sm italic leading-relaxed text-foreground">
                “{item.quote}”
              </blockquote>
            </li>
          ))}
        </ul>
      </DetailSection>

      <DetailSection title="Abstract">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {paper.abstract}
        </p>
      </DetailSection>

      <DetailSection title="Limitations">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {paper.limitation}
        </p>
      </DetailSection>

      <DetailSection title="AI screening">
        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              AI suggests {DECISION_LABELS[paper.aiRecommendation]}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {paper.aiRationale}
          </p>
        </div>
      </DetailSection>

      <DetailSection title="Keywords">
        <div className="flex flex-wrap gap-1.5">
          {paper.keywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
            >
              {keyword}
            </span>
          ))}
        </div>
      </DetailSection>

      {inSession && (
        <DetailSection title="Your decision">
          <div className="space-y-2">
            <DecisionButtons
              paperTitle={paper.title}
              value={decision}
              onChange={(next) => setDecision(paper.id, next)}
            />
            {decision && (
              <p className="text-xs text-muted-foreground">
                Marked as{" "}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px font-semibold ring-1 ring-inset",
                    DECISION_BADGE_STYLES[decision],
                  )}
                >
                  {DECISION_LABELS[decision]}
                </span>
              </p>
            )}
          </div>
        </DetailSection>
      )}
    </div>
  );
}

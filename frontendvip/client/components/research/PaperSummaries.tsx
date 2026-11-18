import { Check, FileText, Quote } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FIELD_LABELS,
  SUMMARY_FIELDS,
  type ExtractionField,
} from "@/lib/research-extraction";
import type { Paper } from "@/lib/research-papers";
import { cn } from "@/lib/utils";

import type { ReviewTools } from "./use-review-tools";

interface PaperSummariesProps {
  review: ReviewTools;
  papers: Paper[];
  onGoToSearch: () => void;
}

export function PaperSummaries({
  review,
  papers,
  onGoToSearch,
}: PaperSummariesProps) {
  if (papers.length === 0) {
    return (
      <EmptyState
        title="No papers in this session yet"
        description="Add papers from Academic search, then generate structured summaries for each one."
        action="Open academic search"
        onAction={onGoToSearch}
      />
    );
  }

  const paper = review.summaryPaper;
  if (!paper) return null;

  const approvedCount = (paperId: string) =>
    SUMMARY_FIELDS.filter(
      (field) => review.getFieldView(paperId, field).isApproved,
    ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside
        aria-label="Session papers"
        className="shrink-0 border-b border-border bg-slate-50/60 lg:w-72 lg:border-b-0 lg:border-r"
      >
        <ul className="flex gap-2 overflow-x-auto p-3 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible">
          {papers.map((item) => {
            const isActive = item.id === paper.id;
            return (
              <li key={item.id} className="w-64 shrink-0 lg:w-auto">
                <button
                  type="button"
                  onClick={() => review.setSummaryPaperId(item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col rounded-lg border px-3 py-2.5 text-left transition-colors",
                    isActive
                      ? "border-primary/40 bg-white shadow-card"
                      : "border-transparent hover:border-border hover:bg-white",
                  )}
                >
                  <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {item.year} · {approvedCount(item.id)} of{" "}
                    {SUMMARY_FIELDS.length} approved
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl space-y-6 px-5 py-6">
          <header>
            <p className="text-xs font-medium text-muted-foreground">
              {paper.year} · {paper.venue}
            </p>
            <h2 className="mt-1 text-base font-semibold leading-snug text-foreground">
              {paper.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {paper.authors.join(", ")}
            </p>
          </header>

          {review.isLoading ? (
            <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
              {SUMMARY_FIELDS.map((field) => (
                <Skeleton key={field} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {SUMMARY_FIELDS.map((field) => (
                <FieldCard
                  key={field}
                  review={review}
                  paperId={paper.id}
                  field={field}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldCard({
  review,
  paperId,
  field,
}: {
  review: ReviewTools;
  paperId: string;
  field: ExtractionField;
}) {
  const view = review.getFieldView(paperId, field);
  const label = FIELD_LABELS[field];

  return (
    <article className="flex flex-col rounded-xl border border-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        {view.isApproved ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            Approved
          </span>
        ) : view.isEdited ? (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200">
            Edited
          </span>
        ) : null}
      </div>

      {view.value ? (
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {view.value}
        </p>
      ) : (
        <p className="mt-2 text-sm italic text-muted-foreground">
          Not reported
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        {view.passage ? (
          <button
            type="button"
            onClick={() =>
              review.openEvidence({ paperId, columnId: field, mode: "view" })
            }
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Quote className="size-3.5" />
            {view.passage.section}, p. {view.passage.page}
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="size-3.5" />
            No supporting passage
          </span>
        )}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              review.openEvidence({ paperId, columnId: field, mode: "edit" })
            }
          >
            Edit
          </Button>
          <Button
            variant={view.isApproved ? "outline" : "default"}
            size="sm"
            onClick={() => review.toggleApproval(paperId, field)}
          >
            <Check className="size-3.5" />
            {view.isApproved ? "Approved" : "Approve"}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-sm rounded-xl border border-dashed border-border bg-white p-8 text-center">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onAction}>
          {action}
        </Button>
      </div>
    </div>
  );
}

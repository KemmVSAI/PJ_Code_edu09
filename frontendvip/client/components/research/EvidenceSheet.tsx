import { Check, Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { FIELD_LABELS, isExtractionField } from "@/lib/research-extraction";
import type { Paper } from "@/lib/research-papers";
import { cn } from "@/lib/utils";

import type { EvidenceTarget, ReviewTools } from "./use-review-tools";

interface EvidenceSheetProps {
  review: ReviewTools;
  papers: Paper[];
}

export function EvidenceSheet({ review, papers }: EvidenceSheetProps) {
  const target = review.evidenceTarget;
  const paper = target
    ? papers.find((item) => item.id === target.paperId)
    : undefined;
  const column = target
    ? review.columns.find((item) => item.id === target.columnId)
    : undefined;
  const label =
    column?.label ??
    (target && isExtractionField(target.columnId)
      ? FIELD_LABELS[target.columnId]
      : "Column");

  return (
    <Sheet
      open={Boolean(target && paper)}
      onOpenChange={(open) => {
        if (!open) review.openEvidence(null);
      }}
    >
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-lg"
      >
        {target && paper && (
          <EvidenceDetail
            key={`${target.paperId}:${target.columnId}:${target.mode}`}
            review={review}
            target={target}
            paperTitle={paper.title}
            label={label}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function EvidenceDetail({
  review,
  target,
  paperTitle,
  label,
}: {
  review: ReviewTools;
  target: EvidenceTarget;
  paperTitle: string;
  label: string;
}) {
  const view = review.getFieldView(target.paperId, target.columnId);
  const isStandardField = isExtractionField(target.columnId);
  const [isEditing, setIsEditing] = useState(target.mode === "edit");
  const [draft, setDraft] = useState(view.value ?? "");

  const handleSave = () => {
    review.saveEdit(target.paperId, target.columnId, draft);
    setIsEditing(false);
  };

  const sourceNote = () => {
    if (view.passage) return null;
    if (view.isEdited) {
      return "This value was entered manually, so no source passage supports it.";
    }
    if (!isStandardField) {
      return "No source passage is linked to this custom column.";
    }
    return "This paper does not report this field, so no passage supports it.";
  };

  return (
    <div className="flex min-h-full flex-col">
      <SheetHeader className="border-b border-border px-6 py-5 text-left">
        <SheetDescription className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Evidence detail
        </SheetDescription>
        <SheetTitle className="text-base font-semibold text-foreground">
          {label}
        </SheetTitle>
        <p className="text-sm leading-snug text-muted-foreground">
          {paperTitle}
        </p>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-6 px-6 py-5">
        <div className="flex flex-wrap gap-2">
          <StatusChip
            tone={view.isApproved ? "emerald" : "amber"}
            label={view.isApproved ? "Approved" : "Pending approval"}
          />
          <StatusChip
            tone={view.isEdited ? "indigo" : "slate"}
            label={
              view.isEdited
                ? "Edited"
                : view.extractedValue === null
                  ? "Not reported"
                  : "Extracted"
            }
          />
        </div>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Value
          </h3>
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={`Edit ${label}`}
                placeholder="Leave empty to mark as Not reported"
                className="min-h-24"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>
                  Save value
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(view.value ?? "");
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-slate-50/70 p-4">
              {view.value ? (
                <p className="text-sm leading-relaxed text-foreground">
                  {view.value}
                </p>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  Not reported
                </p>
              )}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Supporting evidence
          </h3>
          {view.passage ? (
            <figure className="rounded-lg border-l-2 border-primary bg-white py-1 pl-4">
              <figcaption className="text-xs font-medium text-muted-foreground">
                {view.passage.section}, page {view.passage.page}
              </figcaption>
              <blockquote className="mt-1 text-sm italic leading-relaxed text-foreground">
                “{view.passage.text}”
              </blockquote>
            </figure>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              {sourceNote()}
            </p>
          )}
        </section>

        {!isEditing && (
          <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-5">
            <Button
              size="sm"
              variant={view.isApproved ? "outline" : "default"}
              onClick={() =>
                review.toggleApproval(target.paperId, target.columnId)
              }
              className={cn(view.isApproved && "text-emerald-700")}
            >
              <Check className="size-4" />
              {view.isApproved ? "Approved" : "Approve value"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(view.value ?? "");
                setIsEditing(true);
              }}
            >
              <Pencil className="size-4" />
              Edit value
            </Button>
            {view.isEdited && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  review.revertEdit(target.paperId, target.columnId)
                }
              >
                <RotateCcw className="size-4" />
                Revert to extracted
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CHIP_TONES = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
} as const;

function StatusChip({
  tone,
  label,
}: {
  tone: keyof typeof CHIP_TONES;
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        CHIP_TONES[tone],
      )}
    >
      {label}
    </span>
  );
}

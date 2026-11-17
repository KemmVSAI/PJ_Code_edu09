import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FIELD_LABELS,
  MATRIX_FIELDS,
  type ExtractionField,
} from "@/lib/research-extraction";
import type { Paper } from "@/lib/research-papers";

import { EmptyState } from "./PaperSummaries";
import type { MatrixColumn, ReviewTools } from "./use-review-tools";

const TITLE_COLUMN = "title";

interface ComparisonMatrixProps {
  review: ReviewTools;
  papers: Paper[];
  onGoToSearch: () => void;
}

export function ComparisonMatrix({
  review,
  papers,
  onGoToSearch,
}: ComparisonMatrixProps) {
  const [customName, setCustomName] = useState("");

  if (papers.length === 0) {
    return (
      <EmptyState
        title="Nothing to compare yet"
        description="Add papers from Academic search to start building the comparison matrix."
        action="Open academic search"
        onAction={onGoToSearch}
      />
    );
  }

  const { columns, sort } = review;
  const hiddenFields = MATRIX_FIELDS.filter(
    (field) => !columns.some((column) => column.id === field),
  );

  const cellTotal = papers.length * columns.length;
  const approvedTotal = papers.reduce(
    (total, paper) =>
      total +
      columns.filter(
        (column) => review.getFieldView(paper.id, column.id).isApproved,
      ).length,
    0,
  );

  const sortValue = (paper: Paper, columnId: string) =>
    columnId === TITLE_COLUMN
      ? paper.title
      : review.getFieldView(paper.id, columnId).value;

  const sortedPapers = [...papers].sort((a, b) => {
    if (!sort) return 0;
    const left = sortValue(a, sort.columnId);
    const right = sortValue(b, sort.columnId);
    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    const comparison = left.localeCompare(right, undefined, { numeric: true });
    return sort.direction === "asc" ? comparison : -comparison;
  });

  const handleAddColumn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    review.addColumn(customName);
    setCustomName("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <p className="text-sm text-muted-foreground tabular-nums">
          {papers.length} {papers.length === 1 ? "paper" : "papers"} ·{" "}
          {columns.length} {columns.length === 1 ? "column" : "columns"} ·{" "}
          {approvedTotal} of {cellTotal} cells approved
        </p>
        <form onSubmit={handleAddColumn} className="flex gap-2">
          <Input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="Custom column name"
            aria-label="Custom column name"
            className="h-9 w-56"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={!customName.trim()}
          >
            Add column
          </Button>
        </form>
      </div>

      {hiddenFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Restore:</span>
          {hiddenFields.map((field: ExtractionField) => (
            <Button
              key={field}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => review.restoreColumn(field)}
            >
              {FIELD_LABELS[field]}
            </Button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-white shadow-card">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 w-72 bg-white">
                <SortHeader
                  label="Paper"
                  active={
                    sort?.columnId === TITLE_COLUMN ? sort.direction : null
                  }
                  onClick={() => review.toggleSort(TITLE_COLUMN)}
                />
              </TableHead>
              {columns.map((column) => (
                <TableHead key={column.id} className="w-56 min-w-56">
                  <div className="flex items-center justify-between gap-1">
                    <SortHeader
                      label={column.label}
                      active={
                        sort?.columnId === column.id ? sort.direction : null
                      }
                      onClick={() => review.toggleSort(column.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6 shrink-0"
                      aria-label={`Remove column ${column.label}`}
                      onClick={() => review.removeColumn(column.id)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {review.isLoading ? (
              [0, 1, 2].map((row) => (
                <TableRow key={row} className="hover:bg-transparent">
                  <TableCell className="sticky left-0 bg-white">
                    <Skeleton className="h-4 w-56" />
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : columns.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell className="py-10 text-center text-sm text-muted-foreground">
                  All columns are hidden. Restore a column or add a custom one.
                </TableCell>
              </TableRow>
            ) : (
              sortedPapers.map((paper) => (
                <TableRow key={paper.id} className="align-top">
                  <TableCell className="sticky left-0 z-10 bg-white">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                      {paper.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {paper.authors[0]} · {paper.year}
                    </p>
                  </TableCell>
                  {columns.map((column) => (
                    <MatrixCell
                      key={column.id}
                      review={review}
                      paperId={paper.id}
                      paperTitle={paper.title}
                      column={column}
                    />
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: "asc" | "desc" | null;
  onClick: () => void;
}) {
  const Icon =
    active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}`}
      className="inline-flex items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
    >
      {label}
      <Icon className="size-3.5" />
    </button>
  );
}

function MatrixCell({
  review,
  paperId,
  paperTitle,
  column,
}: {
  review: ReviewTools;
  paperId: string;
  paperTitle: string;
  column: MatrixColumn;
}) {
  const view = review.getFieldView(paperId, column.id);
  const openEvidence = (mode: "view" | "edit") =>
    review.openEvidence({ paperId, columnId: column.id, mode });

  return (
    <TableCell className="align-top">
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={() => openEvidence("view")}
          aria-label={`${column.label} for ${paperTitle}`}
          className="min-w-0 flex-1 rounded-md p-1 -m-1 text-left transition-colors hover:bg-accent/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          {view.value ? (
            <span className="line-clamp-3 text-sm leading-snug text-foreground">
              {view.value}
            </span>
          ) : (
            <span className="text-sm italic text-muted-foreground">
              Not reported
            </span>
          )}
          {(view.isApproved || view.isEdited || view.passage) && (
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              {view.isApproved && (
                <span className="font-semibold text-emerald-700">Approved</span>
              )}
              {view.isEdited && (
                <span className="font-semibold text-indigo-700">Edited</span>
              )}
              {view.passage && (
                <span>
                  {view.passage.section}, p. {view.passage.page}
                </span>
              )}
            </span>
          )}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          aria-label={`Edit ${column.label} for ${paperTitle}`}
          onClick={() => openEvidence("edit")}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    </TableCell>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";

import {
  FIELD_LABELS,
  MATRIX_FIELDS,
  isExtractionField,
  type ExtractionField,
  type Passage,
  type PaperExtraction,
} from "@/lib/research-extraction";
import type { Paper } from "@/lib/research-papers";
import {
  answerWithEvidence,
  loadExtraction,
  ResearchServiceError,
  type EvidenceAnswer,
} from "@/lib/research-service";

export interface MatrixColumn {
  id: string;
  label: string;
}

export type MatrixSort = { columnId: string; direction: "asc" | "desc" } | null;

export interface EvidenceTarget {
  paperId: string;
  columnId: string;
  mode: "view" | "edit";
}

export interface FieldView {
  value: string | null;
  extractedValue: string | null;
  passage: Passage | null;
  isEdited: boolean;
  isApproved: boolean;
}

export type RagState =
  | { status: "idle" }
  | { status: "loading"; question: string }
  | { status: "success"; question: string; result: EvidenceAnswer }
  | { status: "error"; question: string; message: string };

const DEFAULT_COLUMNS: MatrixColumn[] = MATRIX_FIELDS.map((field) => ({
  id: field,
  label: FIELD_LABELS[field],
}));

const cellKey = (paperId: string, columnId: string) =>
  `${paperId}::${columnId}`;

const RAG_ERROR_MESSAGE = "Something went wrong while answering. Try again.";

export function useReviewTools(
  collectedPapers: Paper[],
  selectedPapers: Paper[],
) {
  const [extractions, setExtractions] = useState<
    Record<string, PaperExtraction>
  >({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [columns, setColumns] = useState<MatrixColumn[]>(DEFAULT_COLUMNS);
  const [sort, setSort] = useState<MatrixSort>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<EvidenceTarget | null>(
    null,
  );
  const [summaryPaperId, setSummaryPaperId] = useState<string | null>(null);
  const [rag, setRag] = useState<RagState>({ status: "idle" });
  const ragRequest = useRef(0);

  const pendingKey = collectedPapers
    .map((paper) => paper.id)
    .filter((id) => !extractions[id])
    .join("|");

  useEffect(() => {
    let active = true;
    pendingKey
      .split("|")
      .filter(Boolean)
      .forEach((id) => {
        loadExtraction(id).then((extraction) => {
          if (active) {
            setExtractions((previous) => ({ ...previous, [id]: extraction }));
          }
        });
      });
    return () => {
      active = false;
    };
  }, [pendingKey]);

  const isLoading = pendingKey.length > 0;

  const summaryPaper =
    collectedPapers.find((paper) => paper.id === summaryPaperId) ??
    collectedPapers[0] ??
    null;

  const getFieldView = useCallback(
    (paperId: string, columnId: string): FieldView => {
      const extraction = extractions[paperId];
      const field =
        extraction && isExtractionField(columnId)
          ? extraction.fields[columnId]
          : null;
      const passage =
        extraction && field?.passageId
          ? (extraction.passages.find((item) => item.id === field.passageId) ??
            null)
          : null;
      const key = cellKey(paperId, columnId);
      const isEdited = key in edits;
      const extractedValue = field?.value ?? null;

      return {
        value: isEdited ? edits[key] || null : extractedValue,
        extractedValue,
        passage,
        isEdited,
        isApproved: Boolean(approvals[key]),
      };
    },
    [extractions, edits, approvals],
  );

  const saveEdit = useCallback(
    (paperId: string, columnId: string, text: string) => {
      const key = cellKey(paperId, columnId);
      setEdits((previous) => ({ ...previous, [key]: text.trim() }));
      setApprovals((previous) => ({ ...previous, [key]: false }));
    },
    [],
  );

  const revertEdit = useCallback((paperId: string, columnId: string) => {
    const key = cellKey(paperId, columnId);
    setEdits((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    setApprovals((previous) => ({ ...previous, [key]: false }));
  }, []);

  const toggleApproval = useCallback((paperId: string, columnId: string) => {
    const key = cellKey(paperId, columnId);
    setApprovals((previous) => ({ ...previous, [key]: !previous[key] }));
  }, []);

  const addColumn = useCallback((label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setColumns((previous) => [
      ...previous,
      { id: `custom-${Date.now()}`, label: trimmed },
    ]);
  }, []);

  const restoreColumn = useCallback((field: ExtractionField) => {
    setColumns((previous) =>
      previous.some((column) => column.id === field)
        ? previous
        : [...previous, { id: field, label: FIELD_LABELS[field] }],
    );
  }, []);

  const removeColumn = useCallback((columnId: string) => {
    setColumns((previous) =>
      previous.filter((column) => column.id !== columnId),
    );
    setSort((previous) => (previous?.columnId === columnId ? null : previous));
  }, []);

  const toggleSort = useCallback((columnId: string) => {
    setSort((previous) => {
      if (previous?.columnId !== columnId) {
        return { columnId, direction: "asc" };
      }
      if (previous.direction === "asc") {
        return { columnId, direction: "desc" };
      }
      return null;
    });
  }, []);

  const askEvidence = useCallback(
    (question: string) => {
      const text = question.trim();
      if (!text) return;

      const requestId = ++ragRequest.current;
      setRag({ status: "loading", question: text });

      const candidates = selectedPapers.flatMap((paper) =>
        (extractions[paper.id]?.passages ?? []).map((passage) => ({
          paper,
          passage,
        })),
      );

      answerWithEvidence(text, candidates)
        .then((result) => {
          if (requestId !== ragRequest.current) return;
          setRag({ status: "success", question: text, result });
        })
        .catch((error: unknown) => {
          if (requestId !== ragRequest.current) return;
          setRag({
            status: "error",
            question: text,
            message:
              error instanceof ResearchServiceError
                ? error.message
                : RAG_ERROR_MESSAGE,
          });
        });
    },
    [selectedPapers, extractions],
  );

  return {
    isLoading,
    summaryPaper,
    setSummaryPaperId,
    getFieldView,
    saveEdit,
    revertEdit,
    toggleApproval,
    columns,
    addColumn,
    restoreColumn,
    removeColumn,
    sort,
    toggleSort,
    evidenceTarget,
    openEvidence: setEvidenceTarget,
    rag,
    askEvidence,
  };
}

export type ReviewTools = ReturnType<typeof useReviewTools>;

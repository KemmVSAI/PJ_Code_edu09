import { AlertCircle, Send, Sparkles, TriangleAlert } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EVIDENCE_SUGGESTIONS } from "@/lib/research-extraction";
import type { Paper } from "@/lib/research-papers";
import type { EvidenceAnswer } from "@/lib/research-service";
import { cn } from "@/lib/utils";

import { MarkdownMessage } from "./MarkdownMessage";
import type { ReviewTools } from "./use-review-tools";

interface EvidenceRagProps {
  review: ReviewTools;
  selectedPapers: Paper[];
  onSelectPaper: (id: string) => void;
}

export function EvidenceRag({
  review,
  selectedPapers,
  onSelectPaper,
}: EvidenceRagProps) {
  const [question, setQuestion] = useState("");
  const [activePassageId, setActivePassageId] = useState<string | null>(null);
  const { rag, askEvidence, isLoading } = review;
  const canAsk = !isLoading && rag.status !== "loading";

  const submit = (text: string) => {
    if (!text.trim() || !canAsk) return;
    setQuestion(text);
    askEvidence(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit(question);
    }
  };

  const focusSource = (passageId: string) => {
    setActivePassageId(passageId);
    document
      .getElementById(`source-${passageId}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-5 overflow-y-auto px-5 py-6">
      <div className="rounded-xl border border-input bg-white shadow-sm transition-shadow focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
        <Textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question answered only by the selected papers..."
          aria-label="Evidence question"
          disabled={!canAsk}
          className="min-h-[56px] resize-none border-0 px-4 pt-3 shadow-none focus-visible:ring-0"
        />
        <div className="flex items-center justify-between gap-3 px-3 pb-3">
          <span className="truncate text-xs text-muted-foreground">
            {isLoading
              ? "Loading passages..."
              : `Retrieves from ${selectedPapers.length} selected ${selectedPapers.length === 1 ? "paper" : "papers"}`}
          </span>
          <Button
            size="sm"
            disabled={!question.trim() || !canAsk}
            onClick={() => submit(question)}
          >
            <Send className="size-4" />
            {rag.status === "loading" ? "Answering..." : "Ask"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {EVIDENCE_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={!canAsk}
            onClick={() => submit(suggestion)}
            className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {selectedPapers.length === 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <TriangleAlert className="size-3.5 shrink-0" />
          No papers are selected. Select collected papers in Research tools so
          answers can draw on their passages.
        </p>
      )}

      {rag.status === "idle" && (
        <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
            <Sparkles className="size-5" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            Ask the selected papers
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Each answer cites the passages it relies on. If the selected papers
            cannot support an answer, you will see a warning instead.
          </p>
        </div>
      )}

      {rag.status === "loading" && (
        <article
          aria-busy="true"
          className="rounded-xl border border-border bg-white p-5 shadow-card"
        >
          <p className="flex items-center gap-2 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Retrieving passages from selected papers
          </p>
          <div className="mt-4 space-y-2.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/6" />
          </div>
        </article>
      )}

      {rag.status === "error" && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
            <div>
              <p className="text-sm font-semibold text-rose-900">
                The evidence answer could not be generated.
              </p>
              <p className="mt-0.5 text-sm text-rose-800">{rag.message}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 bg-white"
            onClick={() => submit(rag.question)}
          >
            Retry
          </Button>
        </div>
      )}

      {rag.status === "success" && (
        <AnswerView
          question={rag.question}
          result={rag.result}
          activePassageId={activePassageId}
          onCitationSelect={focusSource}
          onSelectPaper={onSelectPaper}
        />
      )}
    </div>
  );
}

function AnswerView({
  question,
  result,
  activePassageId,
  onCitationSelect,
  onSelectPaper,
}: {
  question: string;
  result: EvidenceAnswer;
  activePassageId: string | null;
  onCitationSelect: (passageId: string) => void;
  onSelectPaper: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-xs font-medium text-muted-foreground">
        Question: <span className="text-foreground">{question}</span>
      </p>

      {!result.sufficient && (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Insufficient evidence
            </p>
            <p className="mt-0.5 text-sm text-amber-800">
              The selected papers do not contain enough support for this
              question. Review the closest passages below before drawing any
              conclusion.
            </p>
          </div>
        </div>
      )}

      <article className="rounded-xl border border-border bg-white p-5 shadow-card">
        <p className="mb-4 flex items-center gap-2 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" />
          {result.sufficient ? "AI answer" : "No supported answer"}
        </p>
        <MarkdownMessage
          content={result.content}
          citations={result.citations}
          onCitationSelect={onCitationSelect}
        />
      </article>

      {result.sources.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {result.sufficient ? "Supporting passages" : "Closest passages"}
          </h3>
          <ol className="mt-3 space-y-3">
            {result.sources.map((source, index) => {
              const isActive = activePassageId === source.passage.id;
              return (
                <li
                  key={source.passage.id}
                  id={`source-${source.passage.id}`}
                  className={cn(
                    "rounded-xl border bg-white p-4 transition-shadow",
                    isActive
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border",
                  )}
                >
                  <div className="flex gap-3">
                    {result.sufficient && (
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-xs font-semibold text-primary ring-1 ring-inset ring-indigo-200">
                        {index + 1}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-foreground">
                        {source.paper.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {source.paper.authors[0]}
                        {source.paper.authors.length > 1
                          ? " et al."
                          : ""} · {source.paper.year}
                      </p>
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        {source.passage.section}, page {source.passage.page}
                      </p>
                      <blockquote className="mt-1 border-l-2 border-primary/60 pl-3 text-sm italic leading-relaxed text-slate-700">
                        “{source.passage.text}”
                      </blockquote>
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-2 h-auto p-0"
                        onClick={() => onSelectPaper(source.paper.id)}
                      >
                        Open paper details
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

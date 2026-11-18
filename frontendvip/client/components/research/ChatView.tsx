import { AlertCircle, Send, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SUGGESTED_QUESTIONS, type ChatMessage } from "@/lib/research-papers";

import { MarkdownMessage } from "./MarkdownMessage";
import { getPaper, type ResearchWorkspace } from "./use-research-workspace";

interface ChatViewProps {
  workspace: ResearchWorkspace;
  onSelectPaper: (id: string) => void;
}

function SourceList({
  citations,
  onSelectPaper,
}: {
  citations: string[];
  onSelectPaper: (id: string) => void;
}) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sources
      </h4>
      <ol className="mt-3 space-y-2">
        {citations.map((paperId, index) => {
          const paper = getPaper(paperId);
          if (!paper) return null;
          return (
            <li key={paperId}>
              <button
                type="button"
                onClick={() => onSelectPaper(paperId)}
                className="group flex w-full gap-3 rounded-lg border border-border bg-slate-50/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-white"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-xs font-semibold text-primary ring-1 ring-inset ring-indigo-200">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {paper.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {paper.authors[0]}
                    {paper.authors.length > 1 ? " et al." : ""} · {paper.year} ·{" "}
                    {paper.venue}
                  </span>
                  {paper.evidence[0] && (
                    <span className="mt-2 line-clamp-2 block border-l-2 border-primary/60 pl-2 text-xs italic leading-relaxed text-slate-600">
                      “{paper.evidence[0].quote}”
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AssistantMessage({
  message,
  onSelectPaper,
  onRetry,
  isAnswering,
}: {
  message: ChatMessage;
  onSelectPaper: (id: string) => void;
  onRetry: (id: string) => void;
  isAnswering: boolean;
}) {
  if (message.status === "loading") {
    return (
      <article
        aria-busy="true"
        className="rounded-xl border border-border bg-white p-5 shadow-card"
      >
        <p className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" />
          Synthesizing evidence from your selected papers
        </p>
        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/6" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </article>
    );
  }

  if (message.status === "error") {
    return (
      <div
        role="alert"
        className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              The assistant could not finish this answer.
            </p>
            <p className="mt-0.5 text-sm text-rose-800">
              The literature index may be unavailable. Retry when it is back.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRetry(message.id)}
          disabled={isAnswering}
          className="shrink-0 bg-white"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <article className="rounded-xl border border-border bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Sparkles className="size-3.5" />
          AI synthesis
        </span>
        <span className="text-xs text-muted-foreground">
          Grounded in {message.citations.length}{" "}
          {message.citations.length === 1 ? "source" : "sources"}
        </span>
      </div>
      <MarkdownMessage
        content={message.content}
        citations={message.citations}
        onCitationSelect={onSelectPaper}
      />
      {message.citations.length > 0 && (
        <SourceList
          citations={message.citations}
          onSelectPaper={onSelectPaper}
        />
      )}
    </article>
  );
}

export function ChatView({ workspace, onSelectPaper }: ChatViewProps) {
  const {
    messages,
    draft,
    setDraft,
    isAnswering,
    selectedPapers,
    sendMessage,
    retryAnswer,
    clearConversation,
  } = workspace;
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      sendMessage(draft);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-5">
        <p className="truncate text-sm text-muted-foreground">
          Answers cite only the papers selected for context.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearConversation}
          disabled={messages.length === 0 || isAnswering}
        >
          New conversation
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-5 py-6">
          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
                <Sparkles className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                Start with a research question
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Responses are synthesized from the papers you select, with
                numbered citations that link to source text and evidence.
              </p>
            </div>
          )}

          {messages.map((message) =>
            message.role === "user" ? (
              <div
                key={message.id}
                className="rounded-xl border border-border bg-white px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Research question
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {message.content}
                </p>
              </div>
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                onSelectPaper={onSelectPaper}
                onRetry={retryAnswer}
                isAnswering={isAnswering}
              />
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(draft);
        }}
        className="shrink-0 border-t border-border bg-white px-5 py-4"
      >
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {SUGGESTED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                disabled={isAnswering}
                onClick={() => sendMessage(question)}
                className="shrink-0 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>

          {selectedPapers.length === 0 && (
            <p className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <TriangleAlert className="size-3.5 shrink-0" />
              No papers are selected for context. Select collected papers so
              answers cite source text.
            </p>
          )}

          <div className="rounded-xl border border-input bg-white shadow-sm transition-shadow focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about methods, findings, or gaps in the selected papers..."
              aria-label="Research question"
              disabled={isAnswering}
              className="min-h-[56px] resize-none border-0 px-4 pt-3 shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between gap-3 px-3 pb-3">
              <span className="truncate text-xs text-muted-foreground">
                Grounded in {selectedPapers.length} selected{" "}
                {selectedPapers.length === 1 ? "paper" : "papers"}
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={!draft.trim() || isAnswering}
              >
                <Send className="size-4" />
                {isAnswering ? "Answering..." : "Ask"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

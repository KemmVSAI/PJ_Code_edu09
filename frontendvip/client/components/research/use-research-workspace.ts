import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  EMPTY_SEARCH_FORM,
  PAPER_CATALOG,
  SEED_COLLECTED_IDS,
  SEED_DECISIONS,
  SEED_MESSAGES,
  SEED_SELECTED_IDS,
  type ChatMessage,
  type Paper,
  type PaperDecision,
  type SearchForm,
} from "@/lib/research-papers";
import {
  askAssistant,
  matchPapers,
  ResearchServiceError,
  searchPapers,
} from "@/lib/research-service";

export type WorkspaceView =
  "chat" | "search" | "screening" | "summary" | "evidence" | "matrix";

export interface WorkspaceSeed {
  collectedIds: string[];
  selectedIds: string[];
  decisions: Record<string, PaperDecision>;
  messages: ChatMessage[];
  history: SearchHistoryEntry[];
}

export interface SearchState {
  status: "idle" | "loading" | "success" | "error";
  results: Paper[];
  ranForm: SearchForm | null;
  error: string | null;
}

export interface SearchHistoryEntry {
  id: string;
  form: SearchForm;
  resultCount: number;
  ranAt: string;
}

const PAPERS_BY_ID = new Map(PAPER_CATALOG.map((paper) => [paper.id, paper]));

export const getPaper = (id: string) => PAPERS_BY_ID.get(id);

const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const sameForm = (a: SearchForm, b: SearchForm) =>
  JSON.stringify(a) === JSON.stringify(b);

const SEED_HISTORY: SearchHistoryEntry[] = [
  {
    id: "h-1",
    form: {
      ...EMPTY_SEARCH_FORM,
      query: "hallucination discharge summaries",
      yearFrom: "2023",
    },
    resultCount: 0,
    ranAt: "9:14 AM",
  },
  {
    id: "h-2",
    form: { ...EMPTY_SEARCH_FORM, query: "LLM diagnostic reasoning" },
    resultCount: 0,
    ranAt: "Yesterday",
  },
].map((entry) => ({ ...entry, resultCount: matchPapers(entry.form).length }));

const EMPTY_WORKSPACE_SEED: WorkspaceSeed = {
  collectedIds: [],
  selectedIds: [],
  decisions: {},
  messages: [],
  history: [],
};

const SESSION_SEEDS: Record<string, WorkspaceSeed> = {
  "s-1": {
    collectedIds: SEED_COLLECTED_IDS,
    selectedIds: SEED_SELECTED_IDS,
    decisions: SEED_DECISIONS,
    messages: SEED_MESSAGES,
    history: SEED_HISTORY,
  },
};

export const getWorkspaceSeed = (sessionId: string) =>
  SESSION_SEEDS[sessionId] ?? EMPTY_WORKSPACE_SEED;

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export function useResearchWorkspace(seed: WorkspaceSeed) {
  const [view, setView] = useState<WorkspaceView>("chat");
  const [collectedIds, setCollectedIds] = useState<string[]>(seed.collectedIds);
  const [selectedIds, setSelectedIds] = useState<string[]>(seed.selectedIds);
  const [decisions, setDecisions] = useState<Record<string, PaperDecision>>(
    seed.decisions,
  );
  const [activePaperId, setActivePaperId] = useState<string | null>(null);

  const [searchForm, setSearchForm] = useState<SearchForm>(EMPTY_SEARCH_FORM);
  const [search, setSearch] = useState<SearchState>({
    status: "idle",
    results: [],
    ranForm: null,
    error: null,
  });
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(
    seed.history,
  );
  const searchRequestId = useRef(0);

  const [messages, setMessages] = useState<ChatMessage[]>(seed.messages);
  const [draft, setDraft] = useState("");
  const [isAnswering, setIsAnswering] = useState(false);

  const collectedPapers = useMemo(
    () =>
      collectedIds
        .map(getPaper)
        .filter((paper): paper is Paper => Boolean(paper)),
    [collectedIds],
  );
  const selectedPapers = useMemo(
    () => collectedPapers.filter((paper) => selectedIds.includes(paper.id)),
    [collectedPapers, selectedIds],
  );
  const activePaper = activePaperId ? (getPaper(activePaperId) ?? null) : null;

  const selectPaper = useCallback((id: string) => setActivePaperId(id), []);

  const toggleCollected = useCallback((id: string) => {
    setCollectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
    setSelectedIds((previous) =>
      previous.includes(id) ? previous : [...previous, id],
    );
  }, []);

  const removeFromSession = useCallback((id: string) => {
    setCollectedIds((previous) => previous.filter((item) => item !== id));
    setSelectedIds((previous) => previous.filter((item) => item !== id));
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  }, []);

  const setDecision = useCallback((id: string, decision: PaperDecision) => {
    setDecisions((previous) => {
      const next = { ...previous };
      if (next[id] === decision) {
        delete next[id];
      } else {
        next[id] = decision;
      }
      return next;
    });
  }, []);

  const runSearch = useCallback((form: SearchForm) => {
    const requestId = ++searchRequestId.current;
    setSearchForm(form);
    setView("search");
    setSearch((previous) => ({ ...previous, status: "loading", error: null }));

    searchPapers(form)
      .then((results) => {
        if (requestId !== searchRequestId.current) return;
        setSearch({ status: "success", results, ranForm: form, error: null });
        setSearchHistory((previous) =>
          [
            {
              id: `h-${Date.now()}`,
              form,
              resultCount: results.length,
              ranAt: formatTime(new Date()),
            },
            ...previous.filter((entry) => !sameForm(entry.form, form)),
          ].slice(0, 6),
        );
      })
      .catch((error: unknown) => {
        if (requestId !== searchRequestId.current) return;
        setSearch({
          status: "error",
          results: [],
          ranForm: form,
          error:
            error instanceof ResearchServiceError
              ? error.message
              : "Something went wrong while searching. Try again.",
        });
      });
  }, []);

  const clearSearchHistory = useCallback(() => setSearchHistory([]), []);

  const requestAnswer = useCallback(
    (assistantId: string, question: string) => {
      setIsAnswering(true);
      setMessages((previous) =>
        previous.map((message) =>
          message.id === assistantId
            ? { ...message, status: "loading", content: "", citations: [] }
            : message,
        ),
      );

      askAssistant(question, selectedPapers)
        .then((answer) => {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantId
                ? {
                    ...message,
                    status: "complete",
                    content: answer.content,
                    citations: answer.citations,
                  }
                : message,
            ),
          );
        })
        .catch(() => {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistantId
                ? { ...message, status: "error" }
                : message,
            ),
          );
        })
        .finally(() => setIsAnswering(false));
    },
    [selectedPapers],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question || isAnswering) return;

      const assistantId = `a-${Date.now()}`;
      setDraft("");
      setView("chat");
      setMessages((previous) => [
        ...previous,
        {
          id: `u-${Date.now()}`,
          role: "user",
          content: question,
          citations: [],
          status: "complete",
        },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          citations: [],
          status: "loading",
          question,
        },
      ]);
      requestAnswer(assistantId, question);
    },
    [isAnswering, requestAnswer],
  );

  const retryAnswer = useCallback(
    (assistantId: string) => {
      const message = messages.find((item) => item.id === assistantId);
      if (message?.question && !isAnswering) {
        requestAnswer(assistantId, message.question);
      }
    },
    [messages, isAnswering, requestAnswer],
  );

  const askAboutPaper = useCallback((paper: Paper) => {
    setActivePaperId(paper.id);
    setView("chat");
    setDraft(
      `What are the main findings and limitations reported in "${paper.title}"?`,
    );
  }, []);

  const clearConversation = useCallback(() => setMessages([]), []);

  return {
    view,
    setView,
    collectedPapers,
    selectedIds,
    selectedPapers,
    decisions,
    activePaper,
    selectPaper,
    toggleCollected,
    removeFromSession,
    toggleSelected,
    setDecision,
    searchForm,
    setSearchForm,
    search,
    runSearch,
    searchHistory,
    clearSearchHistory,
    messages,
    draft,
    setDraft,
    isAnswering,
    sendMessage,
    retryAnswer,
    askAboutPaper,
    clearConversation,
  };
}

export type ResearchWorkspace = ReturnType<typeof useResearchWorkspace>;

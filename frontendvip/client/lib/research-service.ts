import { PAPER_CATALOG, type Paper, type SearchForm } from "./research-papers";
import {
  getPaperExtraction,
  type Passage,
  type PaperExtraction,
} from "./research-extraction";

const UNAVAILABLE_TRIGGER = "offline";
const UNAVAILABLE_MESSAGE =
  "The academic index is temporarily unavailable. Try again in a moment.";
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);
const NO_SOURCES_MESSAGE =
  "No studies are selected for this conversation yet. Select papers under **Collected papers** so each answer can be grounded in source text.";

export class ResearchServiceError extends Error {}

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function matchPapers(form: SearchForm): Paper[] {
  const terms = form.query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term && !STOP_WORDS.has(term));
  const author = form.author.trim().toLowerCase();

  return PAPER_CATALOG.map((paper) => {
    const haystack = [paper.title, paper.abstract, ...paper.keywords]
      .join(" ")
      .toLowerCase();
    return {
      paper,
      matched: terms.filter((term) => haystack.includes(term)).length,
    };
  })
    .filter(
      ({ paper, matched }) =>
        (terms.length === 0 || matched > 0) &&
        (form.yearFrom === "all" || paper.year >= Number(form.yearFrom)) &&
        (form.yearTo === "all" || paper.year <= Number(form.yearTo)) &&
        (!author ||
          paper.authors.some((name) => name.toLowerCase().includes(author))) &&
        (form.domain === "all" || paper.domain === form.domain),
    )
    .sort(
      (a, b) => b.matched - a.matched || b.paper.relevance - a.paper.relevance,
    )
    .map(({ paper }) => paper);
}

export async function searchPapers(form: SearchForm): Promise<Paper[]> {
  await delay(700);
  if (form.query.toLowerCase().includes(UNAVAILABLE_TRIGGER)) {
    throw new ResearchServiceError(UNAVAILABLE_MESSAGE);
  }
  return matchPapers(form);
}

export interface AssistantAnswer {
  content: string;
  citations: string[];
}

const leadIn = (paper: Paper) => {
  const surname = paper.authors[0].split(" ")[0];
  return `${surname}${paper.authors.length > 1 ? " et al." : ""} (${paper.year})`;
};

export async function askAssistant(
  question: string,
  sources: Paper[],
): Promise<AssistantAnswer> {
  await delay(1200);
  if (question.toLowerCase().includes(UNAVAILABLE_TRIGGER)) {
    throw new ResearchServiceError(UNAVAILABLE_MESSAGE);
  }
  if (sources.length === 0) {
    return { content: NO_SOURCES_MESSAGE, citations: [] };
  }

  const findings = sources
    .map(
      (paper, index) =>
        `- **${leadIn(paper)}:** ${paper.keyFinding} [${index + 1}]`,
    )
    .join("\n");
  const gaps = sources
    .map(
      (paper, index) =>
        `- **${leadIn(paper)}:** ${paper.limitation} [${index + 1}]`,
    )
    .join("\n");

  return {
    content: [
      `Across the ${sources.length} selected ${sources.length === 1 ? "study" : "studies"}, the evidence relevant to your question is summarized below.`,
      "",
      "## Key findings",
      findings,
      "",
      "## Evidence gaps",
      gaps,
    ].join("\n"),
    citations: sources.map((paper) => paper.id),
  };
}

export async function loadExtraction(
  paperId: string,
): Promise<PaperExtraction> {
  await delay(500);
  return getPaperExtraction(paperId);
}

export interface PassageCandidate {
  paper: Paper;
  passage: Passage;
}

export interface EvidenceSource extends PassageCandidate {
  coverage: number;
}

export interface EvidenceAnswer {
  content: string;
  citations: string[];
  sources: EvidenceSource[];
  sufficient: boolean;
}

const MIN_COVERAGE = 0.5;
const MAX_SOURCES = 3;
const EVIDENCE_STOP_WORDS = new Set([
  "about",
  "and",
  "are",
  "did",
  "does",
  "for",
  "from",
  "have",
  "into",
  "that",
  "the",
  "their",
  "this",
  "was",
  "were",
  "what",
  "which",
  "with",
]);

const stem = (token: string) =>
  token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token;

const tokenize = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !EVIDENCE_STOP_WORDS.has(token))
      .map(stem),
  );

export async function answerWithEvidence(
  question: string,
  candidates: PassageCandidate[],
): Promise<EvidenceAnswer> {
  await delay(900);
  if (question.toLowerCase().includes(UNAVAILABLE_TRIGGER)) {
    throw new ResearchServiceError(UNAVAILABLE_MESSAGE);
  }
  if (candidates.length === 0) {
    return {
      content:
        "No passages are available. Select papers for context before asking a question.",
      citations: [],
      sources: [],
      sufficient: false,
    };
  }

  const terms = tokenize(question);
  const ranked = candidates
    .map((candidate) => {
      const passageTokens = tokenize(candidate.passage.text);
      const matched = [...terms].filter((term) => passageTokens.has(term));
      return {
        ...candidate,
        coverage: terms.size === 0 ? 0 : matched.length / terms.size,
      };
    })
    .filter((source) => source.coverage > 0)
    .sort((a, b) => b.coverage - a.coverage);

  const sufficient = (ranked[0]?.coverage ?? 0) >= MIN_COVERAGE;

  if (!sufficient) {
    return {
      content:
        "The selected papers do not contain enough evidence to answer this question, so no answer is given. The closest passages are listed for review.",
      citations: [],
      sources: ranked.slice(0, MAX_SOURCES),
      sufficient: false,
    };
  }

  const supporting = ranked
    .filter((source) => source.coverage >= MIN_COVERAGE)
    .slice(0, MAX_SOURCES);

  const bullets = supporting.map(
    (source, index) =>
      `- **${leadIn(source.paper)}:** ${source.passage.text} [${index + 1}]`,
  );

  return {
    content: [
      `The selected papers address this question in ${supporting.length} ${supporting.length === 1 ? "passage" : "passages"}.`,
      "",
      ...bullets,
    ].join("\n"),
    citations: supporting.map((source) => source.passage.id),
    sources: supporting,
    sufficient: true,
  };
}

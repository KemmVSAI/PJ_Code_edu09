import { FIELD_LABELS, type ExtractionField } from "./research-extraction";
import { PAPER_CATALOG, type Paper } from "./research-papers";

export type CitationStyle = "APA" | "IEEE" | "Harvard";

export const CITATION_STYLES: readonly CitationStyle[] = [
  "APA",
  "IEEE",
  "Harvard",
];

export type WritingStyle = "academic" | "concise" | "critical";

export const WRITING_STYLES: readonly {
  id: WritingStyle;
  label: string;
  description: string;
}[] = [
  {
    id: "academic",
    label: "Academic",
    description: "Full methodological detail in formal prose.",
  },
  {
    id: "concise",
    label: "Concise",
    description: "Primary findings only, in short statements.",
  },
  {
    id: "critical",
    label: "Critical",
    description: "Adds caveats that point back to study limitations.",
  },
];

export type BodySectionId =
  | "introduction"
  | "related-work"
  | "methodologies"
  | "comparison"
  | "limitations"
  | "gaps";

export const SECTION_TITLES: Record<BodySectionId, string> = {
  introduction: "Introduction",
  "related-work": "Related Work",
  methodologies: "Research Methodologies",
  comparison: "Comparison of Existing Studies",
  limitations: "Research Limitations",
  gaps: "Potential Research Gaps",
};

export const REFERENCES_TITLE = "References";

export const DEFAULT_SECTION_ORDER: BodySectionId[] = [
  "introduction",
  "related-work",
  "methodologies",
  "comparison",
  "limitations",
  "gaps",
];

export interface Citation {
  paperId: string;
  passageId: string | null;
}

export type ParagraphOrigin = "ai" | "ai-suggestion" | "user";

export interface DraftParagraph {
  id: string;
  text: string;
  citations: Citation[];
  origin: ParagraphOrigin;
}

export type DraftParagraphDraft = Omit<DraftParagraph, "id">;

export interface DraftSection {
  id: BodySectionId;
  included: boolean;
  paragraphs: DraftParagraph[];
}

export interface DraftDocument {
  writingStyle: WritingStyle;
  citationStyle: CitationStyle;
  sections: DraftSection[];
}

export interface SourceField {
  value: string | null;
  passageId: string | null;
}

export interface DraftSource {
  paper: Paper;
  fields: Record<ExtractionField, SourceField>;
}

export interface DraftInput {
  topic: string;
  objective: string;
  style: WritingStyle;
  sources: DraftSource[];
}

export const SOURCE_FIELDS = Object.keys(FIELD_LABELS) as ExtractionField[];

const GAP_FIELDS: ExtractionField[] = ["model", "dataset", "setup", "metrics"];

export function createDraft(): DraftDocument {
  return {
    writingStyle: "academic",
    citationStyle: "APA",
    sections: DEFAULT_SECTION_ORDER.map((id) => ({
      id,
      included: true,
      paragraphs: [],
    })),
  };
}

export const createParagraphId = () =>
  `para-${Math.random().toString(36).slice(2, 10)}`;

export const findPaper = (id: string) =>
  PAPER_CATALOG.find((paper) => paper.id === id);

export function findParagraph(doc: DraftDocument, paragraphId: string | null) {
  if (!paragraphId) return null;
  for (const section of doc.sections) {
    const paragraph = section.paragraphs.find((item) => item.id === paragraphId);
    if (paragraph) return { section, paragraph };
  }
  return null;
}

export const countWords = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

export const includedSections = (doc: DraftDocument) =>
  doc.sections.filter((section) => section.included);

export function documentWordCount(doc: DraftDocument) {
  return includedSections(doc)
    .flatMap((section) => section.paragraphs)
    .reduce((total, paragraph) => total + countWords(paragraph.text), 0);
}

export const hasLinkedExcerpt = (paragraph: DraftParagraph) =>
  paragraph.citations.some((citation) => citation.passageId !== null);

export const isUnsupportedClaim = (paragraph: DraftParagraph) =>
  paragraph.origin !== "ai-suggestion" &&
  countWords(paragraph.text) > 0 &&
  !hasLinkedExcerpt(paragraph);

export function countUnsupportedClaims(doc: DraftDocument) {
  return includedSections(doc)
    .flatMap((section) => section.paragraphs)
    .filter(isUnsupportedClaim).length;
}

export function citedPaperIds(doc: DraftDocument): string[] {
  const ids: string[] = [];
  for (const section of includedSections(doc)) {
    for (const paragraph of section.paragraphs) {
      for (const citation of paragraph.citations) {
        if (!ids.includes(citation.paperId)) ids.push(citation.paperId);
      }
    }
  }
  return ids;
}

const splitName = (name: string) => {
  const parts = name.split(" ");
  if (parts.length === 1) return { surname: name, initials: "" };
  return {
    surname: parts.slice(0, -1).join(" "),
    initials: parts[parts.length - 1],
  };
};

const joinNames = (items: string[], conjunction: string, serialComma: boolean) => {
  if (items.length <= 2) return items.join(` ${conjunction} `);
  const head = items.slice(0, -1).join(", ");
  return `${head}${serialComma ? "," : ""} ${conjunction} ${items[items.length - 1]}`;
};

export function formatInText(
  paper: Paper,
  style: CitationStyle,
  number: number,
): string {
  if (style === "IEEE") return `[${number}]`;
  const surnames = paper.authors.map((name) => splitName(name).surname);
  const conjunction = style === "APA" ? "&" : "and";
  const who =
    surnames.length === 1
      ? surnames[0]
      : surnames.length === 2
        ? `${surnames[0]} ${conjunction} ${surnames[1]}`
        : `${surnames[0]} et al.`;
  return `(${who}, ${paper.year})`;
}

export function formatReference(
  paper: Paper,
  style: CitationStyle,
  number = 0,
): string {
  const names = paper.authors.map(splitName);
  if (style === "IEEE") {
    const authors = joinNames(
      names.map(({ surname, initials }) => `${initials} ${surname}`),
      "and",
      true,
    );
    return `[${number}] ${authors}, "${paper.title}," ${paper.venue}, ${paper.year}, doi: ${paper.doi}.`;
  }
  if (style === "APA") {
    const authors =
      names.length === 1
        ? `${names[0].surname}, ${names[0].initials}`
        : `${names
            .slice(0, -1)
            .map(({ surname, initials }) => `${surname}, ${initials}`)
            .join(", ")}, & ${names[names.length - 1].surname}, ${names[names.length - 1].initials}`;
    return `${authors} (${paper.year}). ${paper.title}. ${paper.venue}. https://doi.org/${paper.doi}`;
  }
  const authors = joinNames(
    names.map(({ surname, initials }) => `${surname}, ${initials}`),
    "and",
    false,
  );
  return `${authors} (${paper.year}) '${paper.title}', ${paper.venue}. doi: ${paper.doi}.`;
}

export function formatReferences(doc: DraftDocument): string[] {
  const papers = citedPaperIds(doc)
    .map(findPaper)
    .filter((paper): paper is Paper => Boolean(paper));
  if (doc.citationStyle === "IEEE") {
    return papers.map((paper, index) => formatReference(paper, "IEEE", index + 1));
  }
  return papers
    .map((paper) => formatReference(paper, doc.citationStyle))
    .sort((a, b) => a.localeCompare(b));
}

const lowerFirst = (text: string) =>
  /^[A-Z][a-z]/.test(text)
    ? `${text.charAt(0).toLowerCase()}${text.slice(1)}`
    : text;

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

const valueOf = (source: DraftSource, field: ExtractionField) =>
  source.fields[field].value ?? "Not reported";

const statement = (source: DraftSource, fields: ExtractionField[]) =>
  fields
    .map((field) => `${FIELD_LABELS[field]}: ${valueOf(source, field)}.`)
    .join(" ");

const citeFrom = (source: DraftSource, fields: ExtractionField[]): Citation[] => {
  for (const field of fields) {
    const { value, passageId } = source.fields[field];
    if (value && passageId) return [{ paperId: source.paper.id, passageId }];
  }
  return [];
};

const sourceParagraph = (
  source: DraftSource,
  fields: ExtractionField[],
): DraftParagraphDraft => ({
  text: statement(source, fields),
  citations: citeFrom(source, fields),
  origin: "ai",
});

const choose = <T>(style: WritingStyle, byStyle: Record<WritingStyle, T>): T =>
  byStyle[style];

function buildIntroduction({
  topic,
  objective,
  style,
  sources,
}: DraftInput): DraftParagraphDraft[] {
  const evidence = sources.flatMap((source) => citeFrom(source, ["objective"]));
  const paragraphs: DraftParagraphDraft[] = [
    {
      text: `Research on ${lowerFirst(topic)} has grown, and this review draws on ${plural(sources.length, "study", "studies")}.`,
      citations: evidence,
      origin: "ai",
    },
  ];
  if (style !== "concise") {
    paragraphs.push({
      text: `This ${lowerFirst(objective)} synthesizes the evidence reported across these studies.`,
      citations: evidence,
      origin: "ai",
    });
  }
  return paragraphs;
}

function buildGaps({ sources, style }: DraftInput): DraftParagraphDraft[] {
  const count = sources.length;
  const noun = count === 1 ? "study" : "studies";
  const gaps = GAP_FIELDS.flatMap((field) => {
    const reported = sources.filter(
      (source) => source.fields[field].value !== null,
    ).length;
    if (reported === count) return [];
    const lead = reported === 0 ? "None" : `Only ${reported}`;
    const verb = count === 1 ? "reports" : "report";
    return [
      `${lead} of ${count} selected ${noun} ${verb} ${FIELD_LABELS[field].toLowerCase()}, which limits direct comparison across studies.`,
    ];
  });
  const suggestions =
    gaps.length > 0
      ? gaps
      : [
          "No reporting gaps appear across the selected studies. Check whether studies outside this selection would change the comparison.",
        ];
  return suggestions
    .slice(0, choose(style, { academic: undefined, concise: 2, critical: undefined }))
    .map((text) => ({ text, citations: [], origin: "ai-suggestion" }));
}

export function buildSection(
  sectionId: BodySectionId,
  input: DraftInput,
): DraftParagraphDraft[] {
  const { sources, style } = input;
  if (sources.length === 0) return [];

  switch (sectionId) {
    case "introduction":
      return buildIntroduction(input);
    case "related-work":
      return sources.map((source) =>
        sourceParagraph(
          source,
          choose(style, {
            academic: ["objective", "model"],
            concise: ["objective"],
            critical: ["objective", "limitations"],
          }),
        ),
      );
    case "methodologies":
      return sources.map((source) =>
        sourceParagraph(
          source,
          choose(style, {
            academic: ["methodology", "dataset", "setup"],
            concise: ["methodology"],
            critical: ["methodology", "dataset"],
          }),
        ),
      );
    case "comparison":
      return sources.map((source) =>
        sourceParagraph(
          source,
          choose(style, {
            academic: ["model", "metrics", "results"],
            concise: ["results"],
            critical: ["model", "metrics", "results"],
          }),
        ),
      );
    case "limitations":
      return sources.map((source) =>
        sourceParagraph(source, ["limitations"]),
      );
    case "gaps":
      return buildGaps(input);
  }
}

function firstSentence(text: string) {
  const match = /^.*?[.!?](\s|$)/.exec(text);
  return match ? match[0].trim() : text;
}

export function rewriteText(text: string, style: WritingStyle): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  switch (style) {
    case "concise":
      return firstSentence(trimmed);
    case "critical":
      return `While the evidence is promising, ${lowerFirst(trimmed)}`;
    case "academic":
      return `Overall, ${lowerFirst(trimmed)}`;
  }
}

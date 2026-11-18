export type ExtractionField =
  | "objective"
  | "methodology"
  | "model"
  | "dataset"
  | "setup"
  | "metrics"
  | "results"
  | "limitations";

export const FIELD_LABELS: Record<ExtractionField, string> = {
  objective: "Research objective",
  methodology: "Methodology",
  model: "Model",
  dataset: "Dataset",
  setup: "Experimental setup",
  metrics: "Evaluation metrics",
  results: "Results",
  limitations: "Limitations",
};

export const SUMMARY_FIELDS: ExtractionField[] = [
  "objective",
  "methodology",
  "dataset",
  "setup",
  "results",
  "limitations",
];

export const MATRIX_FIELDS: ExtractionField[] = [
  "objective",
  "methodology",
  "model",
  "dataset",
  "metrics",
  "results",
  "limitations",
];

export const isExtractionField = (id: string): id is ExtractionField =>
  id in FIELD_LABELS;

export interface Passage {
  id: string;
  section: string;
  page: number;
  text: string;
}

export interface FieldExtraction {
  value: string | null;
  passageId: string | null;
}

export interface PaperExtraction {
  paperId: string;
  passages: Passage[];
  fields: Record<ExtractionField, FieldExtraction>;
}

type ExtractionData = Omit<PaperExtraction, "paperId">;

const passage = (
  id: string,
  section: string,
  page: number,
  text: string,
): Passage => ({ id, section, page, text });

const found = (value: string, passageId: string): FieldExtraction => ({
  value,
  passageId,
});

const UNREPORTED: FieldExtraction = { value: null, passageId: null };

const EXTRACTIONS: Record<string, ExtractionData> = {
  "p-101": {
    passages: [
      passage(
        "p101-1",
        "Introduction",
        2,
        "This study benchmarks commercial large language models for diagnostic reasoning in primary care.",
      ),
      passage(
        "p101-2",
        "Methods",
        3,
        "Three commercial models produced differential diagnoses for 412 synthetic clinical vignettes, each scored against a panel of board-certified clinicians.",
      ),
      passage(
        "p101-3",
        "Methods",
        4,
        "Each vignette was posed repeatedly so that response consistency could be measured across runs.",
      ),
      passage(
        "p101-4",
        "Results",
        6,
        "Accuracy on common presentations exceeded 80% across all three model families, but fell below 40% for rare conditions.",
      ),
      passage(
        "p101-5",
        "Discussion",
        8,
        "Consistency across repeated prompts was the weakest dimension we measured.",
      ),
      passage(
        "p101-6",
        "Limitations",
        9,
        "Vignettes were synthetic and drawn from a single training curriculum.",
      ),
    ],
    fields: {
      objective: found(
        "Benchmark commercial LLMs on primary-care diagnostic reasoning",
        "p101-1",
      ),
      methodology: found(
        "Clinician-scored differential diagnoses on synthetic vignettes",
        "p101-2",
      ),
      model: found(
        "Three commercial large language model families (unnamed)",
        "p101-2",
      ),
      dataset: found("412 synthetic primary-care clinical vignettes", "p101-2"),
      setup: found(
        "Each vignette posed repeatedly to measure consistency",
        "p101-3",
      ),
      metrics: found(
        "Diagnostic accuracy against clinician panel; consistency across runs",
        "p101-2",
      ),
      results: found(
        "Over 80% accuracy on common presentations; below 40% on rare conditions",
        "p101-4",
      ),
      limitations: found(
        "Synthetic vignettes from a single training curriculum",
        "p101-6",
      ),
    },
  },
  "p-102": {
    passages: [
      passage(
        "p102-1",
        "Introduction",
        1,
        "We asked whether answers restricted to indexed clinical guidelines contain fewer unsupported statements.",
      ),
      passage(
        "p102-2",
        "Methods",
        3,
        "A standard language model was compared with a retrieval-augmented variant that answers only from indexed guideline passages.",
      ),
      passage(
        "p102-3",
        "Methods",
        4,
        "Passages were indexed from three English-language guideline bodies.",
      ),
      passage(
        "p102-4",
        "Methods",
        4,
        "Two clinical pharmacists rated every response for unsupported statements.",
      ),
      passage(
        "p102-5",
        "Results",
        6,
        "Unsupported statements fell from 22% of responses to 7% once retrieval was enabled.",
      ),
      passage(
        "p102-6",
        "Limitations",
        9,
        "Only three English-language guideline bodies were indexed.",
      ),
    ],
    fields: {
      objective: found(
        "Test whether guideline-grounded answers reduce unsupported statements",
        "p102-1",
      ),
      methodology: found(
        "Standard model compared with a retrieval-augmented variant",
        "p102-2",
      ),
      model: found(
        "Standard language model vs. retrieval-augmented variant",
        "p102-2",
      ),
      dataset: found(
        "Indexed passages from three English-language guideline bodies",
        "p102-3",
      ),
      setup: found("Each response rated by two clinical pharmacists", "p102-4"),
      metrics: found(
        "Share of responses with unsupported statements",
        "p102-5",
      ),
      results: found(
        "Unsupported statements fell from 22% to 7% with retrieval",
        "p102-5",
      ),
      limitations: found(
        "Only three English-language guideline bodies indexed",
        "p102-6",
      ),
    },
  },
  "p-103": {
    passages: [
      passage(
        "p103-1",
        "Methods",
        3,
        "We audited 960 model-generated discharge summaries from four hospitals against their source records.",
      ),
      passage(
        "p103-2",
        "Methods",
        4,
        "A senior clinician at each site classified clinically significant errors.",
      ),
      passage(
        "p103-3",
        "Results",
        6,
        "Clinically significant errors appeared in 12.5% of summaries, most often as omitted allergies.",
      ),
      passage(
        "p103-4",
        "Limitations",
        9,
        "Each site used a single reviewer, so inter-rater agreement is unknown.",
      ),
    ],
    fields: {
      objective: found(
        "Quantify hallucination in LLM-generated discharge summaries",
        "p103-1",
      ),
      methodology: found(
        "Audit of generated summaries against source records",
        "p103-1",
      ),
      model: UNREPORTED,
      dataset: found("960 discharge summaries from four hospitals", "p103-1"),
      setup: found("One senior clinician reviewer per site", "p103-2"),
      metrics: found(
        "Share of summaries with clinically significant errors",
        "p103-3",
      ),
      results: found(
        "12.5% of summaries had clinically significant errors, mostly omitted allergies",
        "p103-3",
      ),
      limitations: found(
        "Single reviewer per site; inter-rater agreement unknown",
        "p103-4",
      ),
    },
  },
  "p-104": {
    passages: [
      passage(
        "p104-1",
        "Methods",
        2,
        "We measured error-rate gaps across age, sex, and language groups in triage classification from free-text notes.",
      ),
      passage(
        "p104-2",
        "Methods",
        3,
        "The classifier was a fine-tuned encoder rather than a generative model.",
      ),
      passage(
        "p104-3",
        "Results",
        5,
        "The largest gap was observed between English and non-English primary-language groups, at six percentage points.",
      ),
      passage(
        "p104-4",
        "Discussion",
        7,
        "Several ethnic subgroups had fewer than 30 cases each.",
      ),
    ],
    fields: {
      objective: found(
        "Measure subgroup error-rate gaps in AI triage",
        "p104-1",
      ),
      methodology: found(
        "Subgroup error-rate analysis of triage classification",
        "p104-1",
      ),
      model: found("Fine-tuned encoder (non-generative)", "p104-2"),
      dataset: found(
        "Free-text triage notes, grouped by age, sex, and language",
        "p104-1",
      ),
      setup: UNREPORTED,
      metrics: found(
        "Error-rate gap between subgroups in percentage points",
        "p104-3",
      ),
      results: found("Six-point error gap between language groups", "p104-3"),
      limitations: found(
        "Several ethnic subgroups had fewer than 30 cases",
        "p104-4",
      ),
    },
  },
  "p-105": {
    passages: [
      passage(
        "p105-1",
        "Methods",
        2,
        "We reviewed 74 studies that applied prompting strategies to medical question answering.",
      ),
      passage(
        "p105-2",
        "Results",
        4,
        "Few-shot prompting was the most frequently reported technique.",
      ),
      passage(
        "p105-3",
        "Results",
        5,
        "Only 31% of the reviewed studies published their full prompt text.",
      ),
      passage(
        "p105-4",
        "Limitations",
        8,
        "The survey is a non-peer-reviewed preprint without clinical outcome data.",
      ),
    ],
    fields: {
      objective: found(
        "Map prompting practices in medical question answering",
        "p105-1",
      ),
      methodology: found(
        "Survey of 74 studies, techniques grouped by reported benefit",
        "p105-1",
      ),
      model: UNREPORTED,
      dataset: UNREPORTED,
      setup: UNREPORTED,
      metrics: UNREPORTED,
      results: found(
        "Few-shot prompting most common; only 31% published full prompts",
        "p105-2",
      ),
      limitations: found(
        "Non-peer-reviewed preprint without clinical outcome data",
        "p105-4",
      ),
    },
  },
  "p-106": {
    passages: [
      passage(
        "p106-1",
        "Methods",
        3,
        "We fine-tuned a clinical language model across eight hospitals without sharing patient records.",
      ),
      passage(
        "p106-2",
        "Methods",
        4,
        "Accuracy was compared with a centralized training baseline.",
      ),
      passage(
        "p106-3",
        "Results",
        6,
        "Federated training came within 2 points of centralized accuracy on the held-out test set.",
      ),
      passage(
        "p106-4",
        "Limitations",
        9,
        "Only training privacy was evaluated, not decision-support outputs.",
      ),
    ],
    fields: {
      objective: found(
        "Assess federated fine-tuning of clinical language models",
        "p106-1",
      ),
      methodology: found(
        "Federated fine-tuning compared with centralized training",
        "p106-2",
      ),
      model: found("Clinical language model", "p106-1"),
      dataset: found("Patient records held at eight hospitals", "p106-1"),
      setup: found(
        "Eight participating hospitals plus a centralized baseline",
        "p106-2",
      ),
      metrics: found("Accuracy on held-out test set", "p106-3"),
      results: found("Within 2 points of centralized accuracy", "p106-3"),
      limitations: found(
        "Only training privacy evaluated, not decision-support outputs",
        "p106-4",
      ),
    },
  },
  "p-107": {
    passages: [
      passage(
        "p107-1",
        "Methods",
        2,
        "Four language models produced impression sections for 300 chest radiograph reports.",
      ),
      passage(
        "p107-2",
        "Methods",
        3,
        "Radiologists rated factual accuracy and the omission of critical findings for each summary.",
      ),
      passage(
        "p107-3",
        "Results",
        5,
        "Critical findings were omitted in 4% of summaries from the top model and 9% from the lowest-ranked model.",
      ),
      passage(
        "p107-4",
        "Limitations",
        8,
        "Reports came from one academic center and a single imaging protocol.",
      ),
    ],
    fields: {
      objective: found(
        "Compare LLMs for radiology report summarization",
        "p107-1",
      ),
      methodology: found(
        "Radiologist ratings of generated impression sections",
        "p107-2",
      ),
      model: found("Four language models compared", "p107-1"),
      dataset: found("300 chest radiograph reports", "p107-1"),
      setup: found("Radiologist rating of accuracy and omissions", "p107-2"),
      metrics: found(
        "Factual accuracy rating; omission rate of critical findings",
        "p107-2",
      ),
      results: found(
        "Critical findings omitted in 4% (top model) vs. 9% (lowest)",
        "p107-3",
      ),
      limitations: found(
        "One academic center and a single imaging protocol",
        "p107-4",
      ),
    },
  },
  "p-108": {
    passages: [
      passage(
        "p108-1",
        "Methods",
        3,
        "We evaluated generative models for assigning ICD-10 codes to 1,200 discharge summaries.",
      ),
      passage(
        "p108-2",
        "Methods",
        4,
        "Model output was compared with assignments from certified coders.",
      ),
      passage(
        "p108-3",
        "Results",
        6,
        "Top-1 code agreement with certified coders was 71%.",
      ),
      passage(
        "p108-4",
        "Results",
        6,
        "Procedure codes accounted for most disagreements with certified coders.",
      ),
      passage(
        "p108-5",
        "Limitations",
        9,
        "Administrative coding accuracy does not measure clinical decision quality.",
      ),
    ],
    fields: {
      objective: found(
        "Evaluate generative models for ICD-10 coding",
        "p108-1",
      ),
      methodology: found(
        "Comparison with certified coder assignments",
        "p108-2",
      ),
      model: found("Generative models (unspecified)", "p108-1"),
      dataset: found("1,200 discharge summaries", "p108-1"),
      setup: UNREPORTED,
      metrics: found("Top-1 code agreement with certified coders", "p108-3"),
      results: found(
        "71% top-1 agreement; most disagreements in procedure codes",
        "p108-3",
      ),
      limitations: found(
        "Coding accuracy does not measure clinical decision quality",
        "p108-5",
      ),
    },
  },
  "p-109": {
    passages: [
      passage(
        "p109-1",
        "Methods",
        3,
        "Semi-structured interviews with 24 clinicians explored how explanation formats affected trust.",
      ),
      passage(
        "p109-2",
        "Methods",
        4,
        "Interviews took place across two urban emergency departments.",
      ),
      passage(
        "p109-3",
        "Findings",
        6,
        "Clinicians trusted short, evidence-linked explanations more than confidence scores alone.",
      ),
      passage(
        "p109-4",
        "Findings",
        7,
        "Participants said links to the underlying note made the suggestion easier to check at the bedside.",
      ),
      passage(
        "p109-5",
        "Limitations",
        10,
        "The qualitative sample came from two urban hospitals only.",
      ),
    ],
    fields: {
      objective: found(
        "Understand how explanation formats affect clinician trust in AI triage",
        "p109-1",
      ),
      methodology: found(
        "Semi-structured interviews with qualitative analysis",
        "p109-1",
      ),
      model: UNREPORTED,
      dataset: found(
        "24 clinicians from two urban emergency departments",
        "p109-2",
      ),
      setup: found("Interview study comparing explanation formats", "p109-1"),
      metrics: UNREPORTED,
      results: found(
        "Short, evidence-linked explanations earned more trust than confidence scores",
        "p109-3",
      ),
      limitations: found(
        "Sample drawn from two urban hospitals only",
        "p109-5",
      ),
    },
  },
  "p-110": {
    passages: [
      passage(
        "p110-1",
        "Methods",
        2,
        "We analyzed regulatory guidance from three jurisdictions.",
      ),
      passage(
        "p110-2",
        "Results",
        5,
        "Validation and post-market monitoring requirements differ substantially across the three jurisdictions.",
      ),
      passage(
        "p110-3",
        "Discussion",
        7,
        "Post-market monitoring obligations were the least harmonized element across the frameworks reviewed.",
      ),
      passage(
        "p110-4",
        "Limitations",
        9,
        "This is a policy analysis without empirical evaluation of deployed tools.",
      ),
    ],
    fields: {
      objective: found(
        "Map regulatory requirements for AI decision-support tools",
        "p110-1",
      ),
      methodology: found("Document analysis of regulatory guidance", "p110-1"),
      model: UNREPORTED,
      dataset: found("Regulatory guidance from three jurisdictions", "p110-1"),
      setup: UNREPORTED,
      metrics: UNREPORTED,
      results: found(
        "Validation and monitoring requirements differ across jurisdictions",
        "p110-2",
      ),
      limitations: found(
        "Policy analysis without empirical evaluation of deployed tools",
        "p110-4",
      ),
    },
  },
  "p-111": {
    passages: [
      passage(
        "p111-1",
        "Methods",
        3,
        "We tested long-context language models on multi-year de-identified patient timelines.",
      ),
      passage(
        "p111-2",
        "Methods",
        4,
        "Each timeline was processed in a single pass up to the model's full context window.",
      ),
      passage(
        "p111-3",
        "Methods",
        5,
        "Clinicians rated the completeness of each generated summary.",
      ),
      passage(
        "p111-4",
        "Results",
        6,
        "Long-context models produced more complete problem lists than chunked pipelines across multi-year timelines.",
      ),
      passage(
        "p111-5",
        "Limitations",
        8,
        "Evaluation used de-identified extracts from a single EHR vendor.",
      ),
    ],
    fields: {
      objective: found(
        "Test long-context models for longitudinal EHR summarization",
        "p111-1",
      ),
      methodology: found(
        "Single-pass processing within the full context window",
        "p111-2",
      ),
      model: found("Long-context language models", "p111-1"),
      dataset: found("Multi-year de-identified patient timelines", "p111-1"),
      setup: found(
        "Each timeline processed in one pass within the context window",
        "p111-2",
      ),
      metrics: found("Clinician-rated completeness of problem lists", "p111-3"),
      results: found(
        "More complete problem lists than chunked pipelines",
        "p111-4",
      ),
      limitations: found("Extracts from a single EHR vendor", "p111-5"),
    },
  },
};

const EMPTY_DATA: ExtractionData = {
  passages: [],
  fields: {
    objective: UNREPORTED,
    methodology: UNREPORTED,
    model: UNREPORTED,
    dataset: UNREPORTED,
    setup: UNREPORTED,
    metrics: UNREPORTED,
    results: UNREPORTED,
    limitations: UNREPORTED,
  },
};

export function getPaperExtraction(paperId: string): PaperExtraction {
  return { paperId, ...(EXTRACTIONS[paperId] ?? EMPTY_DATA) };
}

export const EVIDENCE_SUGGESTIONS = [
  "What share of discharge summaries contained clinically significant errors?",
  "Does retrieval grounding reduce unsupported statements?",
  "Which models performed best on common presentations?",
];

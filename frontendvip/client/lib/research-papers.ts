import { RESEARCH_DOMAINS } from "./research-data";

export type ResearchDomain = (typeof RESEARCH_DOMAINS)[number];

export type PaperDecision = "include" | "exclude" | "maybe";

export interface PaperEvidence {
  section: string;
  quote: string;
}

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  venue: string;
  year: number;
  domain: ResearchDomain;
  citations: number;
  doi: string;
  keywords: string[];
  abstract: string;
  keyFinding: string;
  limitation: string;
  relevance: number;
  aiRecommendation: PaperDecision;
  aiRationale: string;
  evidence: PaperEvidence[];
}

export interface SearchForm {
  query: string;
  yearFrom: string;
  yearTo: string;
  author: string;
  domain: string;
}

export const EMPTY_SEARCH_FORM: SearchForm = {
  query: "",
  yearFrom: "all",
  yearTo: "all",
  author: "",
  domain: "all",
};

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: string[];
  status: "complete" | "loading" | "error";
  question?: string;
}

export const SEARCH_YEARS = [
  "2026",
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
  "2018",
  "2017",
  "2016",
  "2015",
];

export const PAPER_CATALOG: Paper[] = [
  {
    id: "p-101",
    title:
      "Benchmarking large language models for diagnostic reasoning in primary care",
    authors: ["Rivera M.", "Chen L.", "Okafor D."],
    venue: "Journal of Medical AI Systems",
    year: 2025,
    domain: "Medicine & Health",
    citations: 84,
    doi: "10.5555/litreview.101",
    keywords: [
      "diagnostic reasoning",
      "benchmark",
      "primary care",
      "large language models",
    ],
    abstract:
      "We evaluated three commercial large language models on 412 clinical vignettes spanning common and rare primary care presentations. Each model's differential diagnoses were scored against a panel of board-certified clinicians.",
    keyFinding:
      "Frontier models matched resident-level accuracy on most common presentations but reasoned inconsistently on rare conditions.",
    limitation:
      "Vignettes were synthetic and drawn from a single training curriculum.",
    relevance: 92,
    aiRecommendation: "include",
    aiRationale:
      "Directly measures LLM diagnostic support against clinician benchmarks, which matches the review's population and outcome criteria.",
    evidence: [
      {
        section: "Results",
        quote:
          "Accuracy on common presentations exceeded 80% across all three model families, but fell below 40% for rare conditions.",
      },
      {
        section: "Discussion",
        quote:
          "Consistency across repeated prompts was the weakest dimension we measured.",
      },
    ],
  },
  {
    id: "p-102",
    title:
      "Retrieval-augmented generation for clinical guideline question answering",
    authors: ["Patel A.", "Novak J."],
    venue: "Proceedings of the Health Informatics Conference",
    year: 2024,
    domain: "Computer Science",
    citations: 131,
    doi: "10.5555/litreview.102",
    keywords: [
      "retrieval-augmented generation",
      "clinical guidelines",
      "question answering",
      "grounding",
    ],
    abstract:
      "We compared a standard language model with a retrieval-augmented variant that answers only from indexed guideline passages. Two clinical pharmacists rated each response for unsupported statements.",
    keyFinding:
      "Grounding answers in guideline passages cut unsupported statements from 22% to 7%.",
    limitation: "Only three English-language guideline bodies were indexed.",
    relevance: 88,
    aiRecommendation: "include",
    aiRationale:
      "Shows how grounding reduces unsupported claims, which is central to the review's safety question.",
    evidence: [
      {
        section: "Results",
        quote:
          "Unsupported statements fell from 22% of responses to 7% once retrieval was enabled.",
      },
    ],
  },
  {
    id: "p-103",
    title:
      "Hallucination rates in LLM-generated discharge summaries: a multicenter audit",
    authors: ["Lindqvist S.", "Mensah K.", "Brown R."],
    venue: "Clinical Digital Health",
    year: 2025,
    domain: "Medicine & Health",
    citations: 37,
    doi: "10.5555/litreview.103",
    keywords: [
      "hallucination",
      "discharge summaries",
      "clinical safety",
      "audit",
    ],
    abstract:
      "We audited 960 model-generated discharge summaries from four hospitals against their source records. A senior clinician at each site classified clinically significant errors.",
    keyFinding:
      "About one in eight generated summaries contained a clinically significant omission or a fabricated medication.",
    limitation:
      "Each site used a single reviewer, so inter-rater agreement is unknown.",
    relevance: 81,
    aiRecommendation: "include",
    aiRationale:
      "Quantifies hallucination in clinical documentation. The single-reviewer design lowers confidence in the exact rate.",
    evidence: [
      {
        section: "Results",
        quote:
          "Clinically significant errors appeared in 12.5% of summaries, most often as omitted allergies.",
      },
    ],
  },
  {
    id: "p-104",
    title:
      "Fairness of language models across demographic subgroups in triage notes",
    authors: ["Okonkwo E.", "Silva P."],
    venue: "Journal of Medical AI Systems",
    year: 2023,
    domain: "Medicine & Health",
    citations: 56,
    doi: "10.5555/litreview.104",
    keywords: ["fairness", "triage", "subgroup analysis", "bias"],
    abstract:
      "We measured error-rate gaps across age, sex, and language groups in triage classification from free-text notes. The study used a fine-tuned encoder rather than a generative model.",
    keyFinding:
      "Error-rate gaps between language groups reached six percentage points for the same triage category.",
    limitation: "Several ethnic subgroups had fewer than 30 cases each.",
    relevance: 74,
    aiRecommendation: "maybe",
    aiRationale:
      "Relevant to the safety of AI triage, but the encoder model falls outside the generative scope of this review.",
    evidence: [
      {
        section: "Results",
        quote:
          "The largest gap was observed between English and non-English primary-language groups, at six percentage points.",
      },
    ],
  },
  {
    id: "p-105",
    title:
      "A survey of prompt engineering practices in medical question answering",
    authors: ["Dubois C.", "Tan W."],
    venue: "Preprint",
    year: 2024,
    domain: "Computer Science",
    citations: 92,
    doi: "10.5555/litreview.105",
    keywords: ["prompt engineering", "medical question answering", "survey"],
    abstract:
      "We reviewed 74 studies that applied prompting strategies to medical question answering and grouped the techniques by reported benefit.",
    keyFinding:
      "Few-shot prompting was the most frequently reported technique, but prompt details were inconsistently published.",
    limitation:
      "The survey is a non-peer-reviewed preprint without clinical outcome data.",
    relevance: 63,
    aiRecommendation: "maybe",
    aiRationale:
      "Useful background on prompting practice, but it does not report clinical outcomes.",
    evidence: [
      {
        section: "Abstract",
        quote:
          "Only 31% of the reviewed studies published their full prompt text.",
      },
    ],
  },
  {
    id: "p-106",
    title:
      "Federated fine-tuning of clinical language models across hospital networks",
    authors: ["Haddad R.", "Müller F."],
    venue: "Journal of Distributed Health Systems",
    year: 2025,
    domain: "Computer Science",
    citations: 19,
    doi: "10.5555/litreview.106",
    keywords: [
      "federated learning",
      "privacy",
      "clinical language models",
      "fine-tuning",
    ],
    abstract:
      "We fine-tuned a clinical language model across eight hospitals without sharing patient records, then compared its accuracy with centralized training.",
    keyFinding:
      "Federated fine-tuning recovered most of the accuracy gap relative to centralized training.",
    limitation:
      "Only training privacy was evaluated, not decision-support outputs.",
    relevance: 41,
    aiRecommendation: "exclude",
    aiRationale:
      "Focuses on how models are trained rather than on the clinical decision-support outputs this review covers.",
    evidence: [
      {
        section: "Results",
        quote:
          "Federated training came within 2 points of centralized accuracy on the held-out test set.",
      },
    ],
  },
  {
    id: "p-107",
    title:
      "Large language models for radiology report summarization: a comparative study",
    authors: ["Kim S.", "Alvarez J."],
    venue: "Radiology Informatics Review",
    year: 2024,
    domain: "Medicine & Health",
    citations: 49,
    doi: "10.5555/litreview.107",
    keywords: [
      "radiology",
      "summarization",
      "report generation",
      "comparative evaluation",
    ],
    abstract:
      "Four language models produced impression sections for 300 chest radiograph reports. Radiologists rated factual accuracy and the omission of critical findings.",
    keyFinding:
      "The best-performing model omitted a critical finding in 4% of reports, compared with 9% for the weakest model.",
    limitation:
      "Reports came from one academic center and a single imaging protocol.",
    relevance: 77,
    aiRecommendation: "include",
    aiRationale:
      "Measures LLM output accuracy in a clinical documentation task with a concrete safety outcome.",
    evidence: [
      {
        section: "Results",
        quote:
          "Critical findings were omitted in 4% of summaries from the top model and 9% from the lowest-ranked model.",
      },
    ],
  },
  {
    id: "p-108",
    title:
      "Automated ICD-10 coding with generative models: a retrospective evaluation",
    authors: ["Ngata T.", "Schulz H."],
    venue: "Health Information Management",
    year: 2023,
    domain: "Medicine & Health",
    citations: 27,
    doi: "10.5555/litreview.108",
    keywords: [
      "ICD-10",
      "medical coding",
      "generative models",
      "administrative data",
    ],
    abstract:
      "We evaluated generative models for assigning ICD-10 codes to 1,200 discharge summaries and compared the output with certified coder assignments.",
    keyFinding:
      "Top-1 code agreement with certified coders was 71%, with most disagreements in procedure codes.",
    limitation:
      "Administrative coding accuracy does not measure clinical decision quality.",
    relevance: 49,
    aiRecommendation: "exclude",
    aiRationale:
      "Targets administrative coding rather than clinical decision support, so it falls outside the inclusion criteria.",
    evidence: [
      {
        section: "Results",
        quote:
          "Procedure codes accounted for most disagreements with certified coders.",
      },
    ],
  },
  {
    id: "p-109",
    title: "Clinician trust and explanation quality in AI-assisted triage",
    authors: ["Brooks L.", "Nair V."],
    venue: "Human Factors in Health",
    year: 2025,
    domain: "Medicine & Health",
    citations: 33,
    doi: "10.5555/litreview.109",
    keywords: [
      "clinician trust",
      "explainability",
      "triage",
      "qualitative study",
    ],
    abstract:
      "Semi-structured interviews with 24 clinicians explored how explanation formats affected trust in AI triage suggestions across two urban emergency departments.",
    keyFinding:
      "Clinicians trusted short, evidence-linked explanations more than confidence scores alone.",
    limitation: "The qualitative sample came from two urban hospitals only.",
    relevance: 85,
    aiRecommendation: "include",
    aiRationale:
      "Addresses how clinicians act on AI recommendations, which supports the review's human-factors theme.",
    evidence: [
      {
        section: "Findings",
        quote:
          "Participants said links to the underlying note made the suggestion easier to check at the bedside.",
      },
    ],
  },
  {
    id: "p-110",
    title: "Regulatory readiness of LLM-based clinical decision support tools",
    authors: ["Fischer M."],
    venue: "Health Policy Review",
    year: 2024,
    domain: "Medicine & Health",
    citations: 15,
    doi: "10.5555/litreview.110",
    keywords: [
      "regulation",
      "clinical decision support",
      "policy",
      "medical devices",
    ],
    abstract:
      "We analyzed regulatory guidance from three jurisdictions and mapped requirements for validation, monitoring, and post-market surveillance of AI decision support.",
    keyFinding:
      "Validation and post-market monitoring requirements differ substantially across the three jurisdictions.",
    limitation:
      "This is a policy analysis without empirical evaluation of deployed tools.",
    relevance: 67,
    aiRecommendation: "maybe",
    aiRationale:
      "Important context for deployment, but it is a policy analysis rather than an empirical study.",
    evidence: [
      {
        section: "Discussion",
        quote:
          "Post-market monitoring obligations were the least harmonized element across the frameworks reviewed.",
      },
    ],
  },
  {
    id: "p-111",
    title: "Long-context models for longitudinal EHR summarization",
    authors: ["Yildiz A.", "Costa R."],
    venue: "Preprints in Health AI",
    year: 2026,
    domain: "Computer Science",
    citations: 12,
    doi: "10.5555/litreview.111",
    keywords: [
      "electronic health records",
      "long context",
      "summarization",
      "longitudinal data",
    ],
    abstract:
      "We tested long-context language models on multi-year de-identified patient timelines and measured clinician-rated completeness of the generated summaries.",
    keyFinding:
      "Long-context models produced more complete problem lists than chunked pipelines across multi-year timelines.",
    limitation:
      "Evaluation used de-identified extracts from a single EHR vendor.",
    relevance: 90,
    aiRecommendation: "include",
    aiRationale:
      "Strong fit for longitudinal decision support, though the preprint has not yet been peer reviewed.",
    evidence: [
      {
        section: "Methods",
        quote:
          "Each timeline was processed in a single pass up to the model's full context window.",
      },
    ],
  },
];

export const SEED_COLLECTED_IDS = ["p-101", "p-102", "p-103", "p-104", "p-109"];

export const SEED_SELECTED_IDS = ["p-101", "p-102", "p-103"];

export const SEED_DECISIONS: Record<string, PaperDecision> = {
  "p-101": "include",
  "p-102": "include",
  "p-103": "maybe",
};

export const SEED_MESSAGES: ChatMessage[] = [
  {
    id: "m-1",
    role: "user",
    content:
      "What do the selected studies say about hallucination risk in clinical LLM outputs?",
    citations: [],
    status: "complete",
  },
  {
    id: "m-2",
    role: "assistant",
    content: [
      "Across the three selected studies, unsupported content in clinical LLM output is frequent enough that human review remains necessary.",
      "",
      "## Key findings",
      "- **Lindqvist et al. (2025):** About one in eight generated summaries contained a clinically significant omission or a fabricated medication. [1]",
      "- **Rivera et al. (2025):** Frontier models matched resident-level accuracy on most common presentations but reasoned inconsistently on rare conditions. [2]",
      "- **Patel et al. (2024):** Grounding answers in guideline passages cut unsupported statements from 22% to 7%. [3]",
      "",
      "## Evidence gaps",
      "- **Lindqvist et al. (2025):** Each site used a single reviewer, so inter-rater agreement is unknown. [1]",
      "- **Rivera et al. (2025):** Vignettes were synthetic and drawn from a single training curriculum. [2]",
    ].join("\n"),
    citations: ["p-103", "p-101", "p-102"],
    status: "complete",
    question:
      "What do the selected studies say about hallucination risk in clinical LLM outputs?",
  },
];

export const SUGGESTED_QUESTIONS = [
  "What are the main findings across the selected papers?",
  "Which studies report limitations or evidence gaps?",
  "How do the evaluation methods differ between these studies?",
  "How strong is the evidence for clinical deployment?",
];

export const SEARCH_SUGGESTIONS = [
  "hallucination discharge summaries",
  "guideline retrieval grounding",
  "clinician trust triage",
  "long-context EHR",
];

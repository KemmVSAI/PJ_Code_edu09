export type SessionStatus =
  "Draft" | "Collecting" | "Pending review" | "Completed";

export interface ResearchSession {
  id: string;
  topic: string;
  domain: string;
  objective: string;
  papers: number;
  progress: number;
  status: SessionStatus;
}

export interface ResearchProject {
  id: string;
  name: string;
  objective: string;
  description: string;
  updatedAt: string;
  papers: number;
  collaborators: string[];
}

export const CURRENT_USER = {
  firstName: "Amelia",
  fullName: "Amelia Carter",
  email: "amelia.carter@university.edu",
  role: "Research Lead",
  initials: "AC",
};

export const RESEARCH_OBJECTIVES = [
  "Systematic review",
  "Scoping review",
  "Narrative review",
  "Meta-analysis",
] as const;

export const RESEARCH_DOMAINS = [
  "Medicine & Health",
  "Computer Science",
  "Environmental Science",
  "Psychology",
  "Economics",
  "Engineering",
] as const;

export const INITIAL_SESSIONS: ResearchSession[] = [
  {
    id: "s-1",
    topic: "Large language models in clinical decision support",
    domain: "Medicine & Health",
    objective: "Systematic review",
    papers: 128,
    progress: 88,
    status: "Pending review",
  },
  {
    id: "s-2",
    topic: "Federated learning for edge IoT devices",
    domain: "Computer Science",
    objective: "Scoping review",
    papers: 86,
    progress: 45,
    status: "Collecting",
  },
  {
    id: "s-3",
    topic: "Microplastic transport in freshwater systems",
    domain: "Environmental Science",
    objective: "Meta-analysis",
    papers: 214,
    progress: 100,
    status: "Completed",
  },
  {
    id: "s-4",
    topic: "Remote work and productivity after 2020",
    domain: "Economics",
    objective: "Narrative review",
    papers: 57,
    progress: 18,
    status: "Collecting",
  },
  {
    id: "s-5",
    topic: "Gut microbiome and mental health outcomes",
    domain: "Psychology",
    objective: "Systematic review",
    papers: 93,
    progress: 72,
    status: "Pending review",
  },
  {
    id: "s-6",
    topic: "Carbon-neutral concrete formulations",
    domain: "Engineering",
    objective: "Scoping review",
    papers: 41,
    progress: 0,
    status: "Draft",
  },
];

export const RECENT_PROJECTS: ResearchProject[] = [
  {
    id: "p-1",
    name: "Clinical NLP Evidence Map",
    objective: "Systematic review",
    description:
      "Screening 128 abstracts on LLM safety benchmarks for diagnostic support.",
    updatedAt: "2 hours ago",
    papers: 128,
    collaborators: ["AC", "MR", "JP"],
  },
  {
    id: "p-2",
    name: "Edge AI Survey 2026",
    objective: "Scoping review",
    description:
      "Mapping privacy-preserving training methods for resource-constrained sensors.",
    updatedAt: "Yesterday",
    papers: 86,
    collaborators: ["AC", "LK"],
  },
  {
    id: "p-3",
    name: "Freshwater Contaminants Meta-analysis",
    objective: "Meta-analysis",
    description:
      "Pooled effect sizes for polymer fragment accumulation across river basins.",
    updatedAt: "3 days ago",
    papers: 214,
    collaborators: ["AC", "SD", "MR", "TW"],
  },
];

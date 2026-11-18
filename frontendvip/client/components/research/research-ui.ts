import type { PaperDecision } from "@/lib/research-papers";

export const DECISION_LABELS: Record<PaperDecision, string> = {
  include: "Include",
  exclude: "Exclude",
  maybe: "Maybe",
};

export const DECISION_BUTTON_STYLES: Record<PaperDecision, string> = {
  include:
    "aria-pressed:border-emerald-600 aria-pressed:bg-emerald-600 aria-pressed:text-white",
  exclude:
    "aria-pressed:border-rose-600 aria-pressed:bg-rose-600 aria-pressed:text-white",
  maybe:
    "aria-pressed:border-amber-500 aria-pressed:bg-amber-500 aria-pressed:text-white",
};

export const DECISION_BADGE_STYLES: Record<PaperDecision, string> = {
  include: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  exclude: "bg-rose-50 text-rose-700 ring-rose-200",
  maybe: "bg-amber-50 text-amber-700 ring-amber-200",
};

export const scoreBarTone = (score: number) => {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 65) return "bg-primary";
  return "bg-slate-400";
};

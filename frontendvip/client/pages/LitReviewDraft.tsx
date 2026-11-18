import {
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FileEdit,
  FileText,
  Lightbulb,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  Plus,
  Quote,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const sections = [
  "Introduction",
  "Related Work",
  "Research Methodologies",
  "Comparison of Existing Studies",
  "Research Limitations",
  "Potential Research Gaps",
  "References",
];

const papers = [
  { id: "p-101", short: "Rivera et al. (2025)", title: "Benchmarking large language models for diagnostic reasoning", color: "bg-indigo-100 text-indigo-700" },
  { id: "p-102", short: "Patel & Novak (2024)", title: "Retrieval-augmented generation for clinical guideline QA", color: "bg-emerald-100 text-emerald-700" },
  { id: "p-103", short: "Lindqvist et al. (2025)", title: "Hallucination rates in LLM-generated discharge summaries", color: "bg-amber-100 text-amber-700" },
];

const initialParagraph = `Large language models (LLMs) are increasingly being evaluated as assistants for clinical decision support. Recent benchmark studies show that frontier models can approach resident-level performance on common presentations, while reliability decreases for rare conditions (Rivera et al., 2025). This emerging capability has created a need to understand not only model accuracy, but also the evidence and safeguards that support clinical use.`;

export default function LitReviewDraft() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("Introduction");
  const [documentTitle, setDocumentTitle] = useState("Large Language Models in Clinical Decision Support");
  const [paragraph, setParagraph] = useState(initialParagraph);
  const [style, setStyle] = useState("Academic");
  const [citationStyle, setCitationStyle] = useState("APA");
  const [saved, setSaved] = useState(true);
  const [evidenceOpen, setEvidenceOpen] = useState(true);
  const [message, setMessage] = useState("");
  const wordCount = useMemo(() => `${(documentTitle + " " + paragraph).trim().split(/\s+/).length + 736}`, [documentTitle, paragraph]);

  const saveDraft = () => {
    setSaved(true);
    setMessage("Draft saved just now");
    window.setTimeout(() => setMessage(""), 2200);
  };

  const regenerate = () => {
    setParagraph((current) => `${current} Evidence-grounded retrieval further reduces unsupported statements, suggesting that clinical usefulness depends on both model capability and transparent source attribution.`);
    setSaved(false);
    setMessage("Section regenerated with evidence");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-white px-5 py-3">
        <div className="min-w-[240px] flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileEdit className="size-3.5 text-primary" /> Literature review draft <span className="text-slate-300">/</span> Clinical NLP Evidence Map</div>
          <input value={documentTitle} onChange={(e) => { setDocumentTitle(e.target.value); setSaved(false); }} className="mt-1 w-full max-w-xl truncate bg-transparent text-base font-semibold outline-none" aria-label="Document title" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={cn("size-2 rounded-full", saved ? "bg-emerald-500" : "bg-amber-500")} /> {saved ? "Saved 2 min ago" : "Unsaved changes"}</div>
        <Button variant="outline" size="sm" onClick={saveDraft}><Save className="size-4" /> Save draft</Button>
        <Button size="sm" onClick={() => navigate("/review-export")}><Send className="size-4" /> Send to review</Button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-64 shrink-0 overflow-y-auto border-r bg-white p-4 lg:block">
          <p className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Document outline</p>
          <nav className="space-y-1">
            {sections.map((section, index) => <button key={section} onClick={() => setActiveSection(section)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors", activeSection === section ? "bg-indigo-50 font-semibold text-primary" : "text-slate-600 hover:bg-slate-50")}><span className={cn("flex size-5 items-center justify-center rounded-full text-[10px] font-semibold", activeSection === section ? "bg-primary text-white" : "bg-slate-100 text-slate-500")}>{index + 1}</span><span className="truncate">{section}</span>{activeSection === section && <ChevronRight className="ml-auto size-3.5" />}</button>)}
          </nav>
          <div className="mt-6 border-t pt-5"><p className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Selected papers</p>{papers.map((paper) => <button key={paper.id} className="mb-2 flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-slate-50"><span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold", paper.color)}>{paper.short[0]}</span><span className="truncate text-xs text-slate-600">{paper.short}</span></button>)}<Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-primary"><Plus className="size-3.5" /> Add paper</Button></div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><Badge variant="secondary" className="mb-2 bg-indigo-50 text-primary">AI-assisted draft</Badge><h2 className="text-xl font-semibold text-navy">{activeSection}</h2><p className="mt-1 text-sm text-muted-foreground">Drafting from 3 selected papers and 8 verified evidence passages</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={regenerate}><RefreshCw className="size-3.5" /> Regenerate section</Button><Button variant="outline" size="sm" onClick={() => setEvidenceOpen((v) => !v)}><PanelRight className="size-3.5" /> Evidence</Button></div></div>
            <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b bg-slate-50/70 px-6 py-3"><span className="text-xs font-medium text-muted-foreground">Introduction · 1 of 7</span><div className="flex gap-1"><Button variant="ghost" size="icon" className="size-8" title="Rewrite paragraph" onClick={regenerate}><WandSparkles className="size-4 text-primary" /></Button><Button variant="ghost" size="icon" className="size-8" title="Add citation"><Quote className="size-4" /></Button><Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button></div></div>
              <div className="p-7 sm:p-10"><div className="mb-8 text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Literature review</p><h1 className="mt-3 text-2xl font-bold leading-tight text-navy">{documentTitle}</h1><p className="mt-2 text-sm text-muted-foreground">A systematic review of evidence, methods, and clinical readiness</p></div><div className="prose prose-slate max-w-none"><h3>1. Introduction</h3><Textarea value={paragraph} onChange={(e) => { setParagraph(e.target.value); setSaved(false); }} className="min-h-36 resize-y border-0 bg-transparent p-0 text-[15px] leading-7 shadow-none focus-visible:ring-0" /><div className="my-5 rounded-r-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4" /> Unsupported claim detected</div><p className="mt-1 text-xs leading-5">“Frontier models improve patient outcomes” needs a supporting source. Add evidence or soften the claim.</p><Button variant="link" size="sm" className="h-auto px-0 text-amber-800">Inspect evidence</Button></div><p className="text-[15px] leading-7">The literature also points to a distinction between performance in controlled evaluations and safe deployment in practice. Retrieval-augmented systems reduced unsupported statements from 22% to 7% in a clinical question-answering evaluation <span className="rounded bg-indigo-50 px-1 text-primary">(Patel & Novak, 2024)</span>. However, multicenter audits continue to identify clinically significant omissions in generated summaries <span className="rounded bg-indigo-50 px-1 text-primary">(Lindqvist et al., 2025)</span>.</p><div className="my-6 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4"><div className="flex items-start gap-3"><Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold text-indigo-950">AI research gap suggestion</p><p className="mt-1 text-sm leading-6 text-indigo-900">Few studies compare evidence-grounding quality and clinical safety across the same evaluation protocol.</p><button className="mt-2 text-xs font-semibold text-primary hover:underline">Add to Potential Research Gaps →</button></div></div></div><h3>Next section preview</h3><p className="text-[15px] leading-7 text-slate-500">Related work will synthesize benchmark performance, retrieval grounding, and real-world documentation audits.</p></div></div>
              <div className="flex flex-wrap items-center gap-4 border-t bg-slate-50/60 px-6 py-3 text-xs text-muted-foreground"><span>{wordCount} words</span><span>•</span><span>3 citations</span><span className="ml-auto">Style: {style} · {citationStyle}</span></div>
            </Card>
            <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-muted-foreground">Writing style</span>{["Academic", "Concise", "Critical"].map((item) => <button key={item} onClick={() => setStyle(item)} className={cn("rounded-full border px-3 py-1 text-xs", style === item ? "border-primary bg-indigo-50 font-semibold text-primary" : "bg-white text-slate-600")}>{item}</button>)}<span className="ml-3 text-xs font-medium text-muted-foreground">Citations</span>{["APA", "IEEE", "Harvard"].map((item) => <button key={item} onClick={() => setCitationStyle(item)} className={cn("rounded-full border px-3 py-1 text-xs", citationStyle === item ? "border-primary bg-indigo-50 font-semibold text-primary" : "bg-white text-slate-600")}>{item}</button>)}</div>
          </div>
        </main>

        {evidenceOpen && <aside className="hidden w-80 shrink-0 overflow-y-auto border-l bg-white p-4 xl:block"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">Contextual evidence</p><p className="mt-0.5 text-xs text-muted-foreground">Linked to current section</p></div><Badge className="bg-emerald-100 text-emerald-700">8 verified</Badge></div><div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3"><div className="flex gap-2"><Sparkles className="size-4 shrink-0 text-primary" /><p className="text-xs leading-5 text-indigo-950">Evidence-grounded suggestions are based on your selected papers.</p></div></div>{papers.map((paper, index) => <Card key={paper.id} className="mb-3 border-slate-200 p-3 shadow-none"><div className="flex items-start gap-2"><span className={cn("mt-0.5 flex size-6 items-center justify-center rounded text-[10px] font-bold", paper.color)}>[{index + 1}]</span><div className="min-w-0"><p className="text-xs font-semibold leading-4">{paper.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{paper.short} · {paper.id === "p-102" ? "Results" : "Discussion"}</p></div></div><p className="mt-3 border-l-2 border-slate-200 pl-3 text-xs italic leading-5 text-slate-600">“{index === 0 ? "Accuracy exceeded 80% on common presentations but fell below 40% for rare conditions." : index === 1 ? "Unsupported statements fell from 22% to 7% once retrieval was enabled." : "Clinically significant errors appeared in 12.5% of summaries."}”</p><button className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"><Eye className="size-3" /> Inspect source</button></Card>)}<Button variant="outline" size="sm" className="w-full"><Quote className="size-3.5" /> Add citation from evidence</Button></aside>}
      </div>
      {message && <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-navy px-4 py-2 text-xs font-medium text-white shadow-lg"><Check className="size-3.5 text-emerald-300" /> {message}</div>}
    </div>
  );
}

"""One-shot patcher — tích hợp 3 panel W3/W4 vào frontend/app/chat/page.tsx."""

from pathlib import Path

page = Path("frontend/app/chat/page.tsx")
src = page.read_text(encoding="utf-8")

# 1. imports
old_imports = '''import {
  addPapers,
  chat,
  getCorpus,
  getScreeningResults,
  getWorkingSet,
  resumeChat,
  screenPapers,
  searchPapers,
  type Paper,
  type ScreeningItem,
  type ToolKind,
} from "@/lib/api";
import ScreeningPanel from "./ScreeningPanel";'''
new_imports = '''import {
  addPapers,
  askRAG,
  chat,
  editSummaryField,
  generateDraft,
  getCorpus,
  getDraft,
  getScreeningResults,
  getSummaries,
  getWorkingSet,
  resumeChat,
  screenPapers,
  searchPapers,
  summarizePaper,
  type DraftInfo,
  type Paper,
  type RAGResult,
  type ScreeningItem,
  type SummaryInfo,
  type ToolKind,
} from "@/lib/api";
import ScreeningPanel from "./ScreeningPanel";
import { DraftPanel, RagPanel, SummaryPanel } from "./WorkflowPanels";'''
assert old_imports in src, "imports anchor"
src = src.replace(old_imports, new_imports, 1)

# 2. state
old_state = """  const [corpusVersion, setCorpusVersion] = useState(1);
  const [corpusCount, setCorpusCount] = useState(0);"""
new_state = """  const [corpusVersion, setCorpusVersion] = useState(1);
  const [corpusCount, setCorpusCount] = useState(0);
  const [summaries, setSummaries] = useState<SummaryInfo[]>([]);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [ragHistory, setRagHistory] = useState<RAGResult[]>([]);
  const [ragBusy, setRagBusy] = useState(false);
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  const [generating, setGenerating] = useState(false);"""
assert old_state in src, "state anchor"
src = src.replace(old_state, new_state, 1)

# 3. session restore
old_restore = """    getScreeningResults(sessionId).then(setScreenItems).catch(() => setScreenItems([]));
    getCorpus(sessionId)"""
new_restore = """    getScreeningResults(sessionId).then(setScreenItems).catch(() => setScreenItems([]));
    getSummaries(sessionId).then(setSummaries).catch(() => setSummaries([]));
    getDraft(sessionId)
      .then((d) => setDraft(d.generation_status === "no_draft" ? null : d))
      .catch(() => setDraft(null));
    getCorpus(sessionId)"""
assert old_restore in src, "restore anchor"
src = src.replace(old_restore, new_restore, 1)

# 4. handlers
anchor = '''  function onScreenDecided(msg: string) {
    setMessages((m) => [...m, { role: "system", content: msg }]);
    void refreshCorpus();
  }'''
addition = '''  function onScreenDecided(msg: string) {
    setMessages((m) => [...m, { role: "system", content: msg }]);
    void refreshCorpus();
  }

  // --- Summary (W3) ---
  async function handleSummarize(paperId: string) {
    if (summarizing || !sessionId) return;
    setSummarizing(paperId);
    try {
      const resp = await summarizePaper(sessionId, paperId);
      setSummaries((prev) => [...prev.filter((s) => s.paper_id !== paperId), resp]);
      if (resp.summary_status !== "completed") {
        setMessages((m) => [
          ...m,
          { role: "system", content: `Summary thất bại (${resp.summary_status}) — thử lại.` },
        ]);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: err instanceof Error ? err.message : "Summary thất bại" },
      ]);
    } finally {
      setSummarizing(null);
    }
  }

  async function handleEditField(paperId: string, field: string, value: string) {
    if (!value.trim() || !sessionId) return;
    try {
      const updated = await editSummaryField(sessionId, paperId, field, value);
      setSummaries((prev) => [...prev.filter((s) => s.paper_id !== paperId), updated]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: err instanceof Error ? err.message : "Sửa summary thất bại" },
      ]);
    }
  }

  // --- RAG (W4) ---
  async function handleRag(question: string) {
    if (ragBusy || !sessionId) return;
    setRagBusy(true);
    setMessages((m) => [...m, { role: "user", content: `[RAG] ${question}` }]);
    try {
      const resp = await askRAG(sessionId, question);
      setRagHistory((h) => [resp, ...h]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: err instanceof Error ? err.message : "RAG thất bại" },
      ]);
    } finally {
      setRagBusy(false);
    }
  }

  // --- Generator (W4) ---
  async function handleGenerate() {
    if (generating || !sessionId) return;
    setGenerating(true);
    setMessages((m) => [...m, { role: "system", content: "Đang tạo Comparison Matrix + Synthesis Draft…" }]);
    try {
      const resp = await generateDraft(sessionId);
      setDraft(resp);
      if (resp.generation_status !== "completed") {
        setMessages((m) => [
          ...m,
          { role: "system", content: `Generate thất bại: ${resp.generation_error || resp.generation_status}` },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "system",
            content: `Draft hoàn tất — ${resp.unsupported_count} claim unsupported. Xem chi tiết ở panel Matrix & Draft; duyệt và export tại trang Review & Export.`,
          },
        ]);
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: err instanceof Error ? err.message : "Generate thất bại" },
      ]);
    } finally {
      setGenerating(false);
    }
  }'''
assert anchor in src, "handler anchor"
src = src.replace(anchor, addition, 1)

# 5. runWorkflow route
old_wf = '''  async function runWorkflow(kind: ToolKind, payload?: string) {
    // Screening có endpoint riêng (W2) — chạy trực tiếp, không qua prompt agent
    if (kind === "screen") {
      if (workingSet.length === 0) {
        setMessages((m) => [
          ...m,
          { role: "system", content: "Screening cần Working Set có paper. Dùng Search bên phải để thêm paper trước." },
        ]);
        return;
      }
      setActiveTool(kind);
      await handleScreen();
      setActiveTool(null);
      return;
    }
    const tool = TOOLS.find((t) => t.kind === kind);'''
new_wf = '''  async function runWorkflow(kind: ToolKind, payload?: string) {
    // Các workflow W2–W4 có endpoint riêng — chạy trực tiếp, không qua prompt agent
    if (kind === "screen") {
      if (workingSet.length === 0) {
        setMessages((m) => [
          ...m,
          { role: "system", content: "Screening cần Working Set có paper. Dùng Search bên phải để thêm paper trước." },
        ]);
        return;
      }
      setActiveTool(kind);
      await handleScreen();
      setActiveTool(null);
      return;
    }
    if (kind === "summary") {
      const done = new Set(summaries.filter((s) => s.summary_status === "completed").map((s) => s.paper_id));
      const todo = workingSet.filter((p) => !done.has(p.paper_id));
      if (todo.length === 0) {
        setMessages((m) => [...m, { role: "system", content: "Tất cả paper đã có summary hoàn tất." }]);
        return;
      }
      setActiveTool(kind);
      for (const p of todo) {
        await handleSummarize(p.paper_id);
      }
      setActiveTool(null);
      return;
    }
    if (kind === "rag") {
      if (corpusCount === 0) {
        setMessages((m) => [
          ...m,
          {
            role: "system",
            content: "RAG cần Confirmed Corpus — Accept/Override ít nhất một paper ở panel Screening trước.",
          },
        ]);
        return;
      }
      setActiveTool(kind);
      const q = payload?.trim() || window.prompt("Câu hỏi trên Confirmed Corpus:") || "";
      if (q.trim()) {
        await handleRag(q.trim());
      }
      setActiveTool(null);
      return;
    }
    if (kind === "matrix" || kind === "generate") {
      setActiveTool(kind);
      await handleGenerate();
      setActiveTool(null);
      return;
    }
    const tool = TOOLS.find((t) => t.kind === kind);'''
assert old_wf in src, "runWorkflow anchor"
src = src.replace(old_wf, new_wf, 1)

# 6. panels vào aside
old_aside = '''        <ScreeningPanel
          sessionId={sessionId}
          items={screenItems}
          corpusVersion={corpusVersion}
          corpusCount={corpusCount}
          onScreen={handleScreen}
          onDecided={onScreenDecided}
          screening={screening}
        />
      </aside>'''
new_aside = '''        <ScreeningPanel
          sessionId={sessionId}
          items={screenItems}
          corpusVersion={corpusVersion}
          corpusCount={corpusCount}
          onScreen={handleScreen}
          onDecided={onScreenDecided}
          screening={screening}
        />

        <RagPanel
          sessionId={sessionId}
          corpusCount={corpusCount}
          ragHistory={ragHistory}
          onAsk={handleRag}
          busy={ragBusy}
        />

        <SummaryPanel
          sessionId={sessionId}
          workingSet={workingSet}
          summaries={summaries}
          onSummarize={handleSummarize}
          onEditField={handleEditField}
          busy={thinking}
          summarizing={summarizing}
        />

        <DraftPanel
          sessionId={sessionId}
          draft={draft}
          onGenerate={handleGenerate}
          busy={thinking}
          generating={generating}
        />
      </aside>'''
assert old_aside in src, "aside anchor"
src = src.replace(old_aside, new_aside, 1)

page.write_text(src, encoding="utf-8")
print("page.tsx patched OK")

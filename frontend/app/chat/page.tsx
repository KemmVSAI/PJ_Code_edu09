"use client";

/**
 * Research Chat — trang 2/3, trung tâm của workflow.
 *
 * Một hội thoại duy nhất với agent, phủ 6 chức năng theo PRD v1.1 mục 11.1:
 *   Search → Screening → Summary → RAG → Comparison Matrix → Generate Draft.
 *
 * Bố cục 3 cột:
 *   trái  — tool rail: 6 chức năng, bấm để chạy (tool request qua agent)
 *   giữa  — hội thoại chat (user/assistant), streaming-style, HITL resume
 *   phải  — Working Set / kết quả search, thêm paper vào Working Set
 *
 * Trạng thái tuân theo ui-flow.md: processing, error (retry), empty states.
 * HITL: response chứa "[CẦN PHÊ DUYỆT]" → hiện nút Approve/Reject (/chat/resume).
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  addPapers,
  chat,
  getWorkingSet,
  resumeChat,
  searchPapers,
  type Paper,
  type ToolKind,
} from "@/lib/api";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  detail?: string;
  needsApproval?: boolean;
}

const TOOLS: { kind: ToolKind; label: string; hint: string; needsCorpus: boolean }[] = [
  { kind: "search", label: "Search", hint: "Tìm bài báo OpenAlex", needsCorpus: false },
  { kind: "screen", label: "Screening", hint: "Phân loại mức độ liên quan", needsCorpus: false },
  { kind: "summary", label: "Summary", hint: "Tóm tắt 5 trường có provenance", needsCorpus: true },
  { kind: "rag", label: "RAG", hint: "Hỏi đáp trên Confirmed Corpus", needsCorpus: true },
  { kind: "matrix", label: "Comparison Matrix", hint: "Bảng so sánh từng paper", needsCorpus: true },
  { kind: "generate", label: "Generate Draft", hint: "Tạo bản nháp Literature Review", needsCorpus: true },
];

function ChatInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Paper[]>([]);
  const [searchError, setSearchError] = useState("");
  const [workingSet, setWorkingSet] = useState<Paper[]>([]);
  const [searching, setSearching] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolKind | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // Session restore — FR-SES-02: mở lại session giữ Research Question + Working Set.
  useEffect(() => {
    if (!sessionId) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/sessions/${sessionId}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error("Session không tồn tại"))))
      .then((s: { research_question: string }) => {
        setMessages([
          {
            role: "system",
            content: `Research Question: ${s.research_question}. Chọn chức năng bên trái hoặc hỏi trực tiếp.`,
          },
        ]);
      })
      .catch((err: Error) =>
        setMessages([{ role: "system", content: `${err.message}. Quay lại Dashboard để tạo phiên mới.` }]),
      );
    getWorkingSet(sessionId).then(setWorkingSet).catch(() => setWorkingSet([]));
  }, [sessionId]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || thinking) return;
    setMessages((m) => [...m, { role: "user", content }]);
    setInput("");
    setThinking(true);
    try {
      const resp = await chat(content, sessionId || crypto.randomUUID());
      const needsApproval = resp.response.startsWith("[CẦN PHÊ DUYỆT]");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: resp.response, detail: resp.analysis, needsApproval },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Lỗi không xác định",
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  async function handleResume(decision: "approve" | "reject") {
    setThinking(true);
    try {
      const resp = await resumeChat(sessionId, decision);
      setMessages((m) => [
        ...m,
        {
          role: "system",
          content: `Bạn đã ${decision === "approve" ? "phê duyệt" : "từ chối"} hành động.`,
        },
        { role: "assistant", content: resp.response, detail: resp.analysis },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: err instanceof Error ? err.message : "Resume thất bại" },
      ]);
    } finally {
      setThinking(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim() || !sessionId) return;
    setSearching(true);
    setSearchError("");
    setSearchResults([]);
    try {
      const resp = await searchPapers(sessionId, searchQuery.trim());
      if (resp.error) {
        setSearchError(resp.error); // FR-SRCH-05: lỗi + retry, không kết quả dở
      } else {
        setSearchResults(resp.results);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Tìm kiếm thất bại");
    } finally {
      setSearching(false);
    }
  }

  async function handleAddSelected() {
    if (selected.size === 0) return;
    try {
      const resp = await addPapers(sessionId, [...selected]);
      setWorkingSet(resp.working_set);
      setSelected(new Set());
      setMessages((m) => [
        ...m,
        {
          role: "system",
          content: `Đã thêm ${resp.added.length} paper vào Working Set${resp.skipped_duplicates.length ? `, bỏ qua ${resp.skipped_duplicates.length} paper trùng` : ""}.`,
        },
      ]);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Thêm paper thất bại");
    }
  }

  async function runWorkflow(kind: ToolKind, payload?: string) {
    const tool = TOOLS.find((t) => t.kind === kind);
    if (thinking) return;
    if (tool?.needsCorpus && workingSet.length === 0) {
      setMessages((m) => [
        ...m,
        { role: "system", content: `${tool.label} cần Working Set có paper. Dùng Search bên phải để thêm paper trước.` },
      ]);
      return;
    }
    setActiveTool(kind);
    await send(`[${tool?.label ?? kind}] ${payload ?? ""}`.trim());
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr_340px]">
      {/* Tool rail */}
      <aside className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Workflow</h2>
        {TOOLS.map((tool) => (
          <button
            key={tool.kind}
            onClick={() => runWorkflow(tool.kind)}
            disabled={thinking || activeTool !== null}
            title={tool.hint}
            className={`w-full rounded-xl border p-3 text-left text-sm transition ${
              activeTool === tool.kind
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white hover:border-zinc-400"
            } disabled:opacity-50`}
          >
            <span className="block font-medium">{tool.label}</span>
            <span className={`block text-xs ${activeTool === tool.kind ? "text-zinc-300" : "text-zinc-500"}`}>
              {tool.hint}
            </span>
          </button>
        ))}
        <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-3 text-xs text-zinc-600">
          <p className="font-medium text-zinc-800">Quy trình</p>
          <p className="mt-1">
            Search → thêm vào Working Set → Screening → review → Confirmed Corpus → Summary / RAG / Matrix / Draft.
            Draft xong sang trang <Link className="underline" href="/review">Review &amp; Export</Link>.
          </p>
        </div>
      </aside>

      {/* Chat column */}
      <section className="flex min-h-[70vh] flex-col rounded-2xl border border-zinc-200 bg-white">
        <header className="border-b border-zinc-200 px-5 py-3">
          <h1 className="font-semibold">Research Chat</h1>
          <p className="line-clamp-1 text-xs text-zinc-500">
            {sessionId ? `Session: ${sessionId}` : "Chưa có session — chọn từ Dashboard"}
          </p>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              Nhập câu hỏi hoặc chọn một chức năng bên trái. Agent trả lời dựa trên evidence và trích nguồn;
              thiếu căn cứ sẽ nói rõ thay vì suy diễn.
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "ml-auto bg-zinc-900 text-white"
                  : msg.role === "system"
                    ? "mx-auto bg-zinc-100 text-center text-xs text-zinc-500"
                    : "border border-zinc-200 bg-zinc-50"
              }`}
            >
              {msg.content}
              {msg.detail && <span className="mt-1 block text-xs text-zinc-400">{msg.detail}</span>}
              {msg.needsApproval && (
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => handleResume("approve")}
                    disabled={thinking}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleResume("reject")}
                    disabled={thinking}
                    className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
              Agent đang xử lý — searching / screening / summarizing / generating…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-zinc-200 p-3"
        >
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={sessionId ? "Nhập câu hỏi hoặc yêu cầu…" : "Chưa có session — mở từ Dashboard"}
              disabled={!sessionId || thinking}
              className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-zinc-900 disabled:bg-zinc-50"
            />
            <button
              type="submit"
              disabled={!sessionId || thinking || !input.trim()}
              className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
            >
              Gửi
            </button>
          </div>
        </form>
      </section>

      {/* Search & Working Set */}
      <aside className="space-y-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Tìm bài báo (OpenAlex)</h2>
          <form onSubmit={handleSearch} className="mt-2 flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Từ khóa…"
              disabled={!sessionId || searching}
              className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900"
            />
            <button
              type="submit"
              disabled={!sessionId || searching || !searchQuery.trim()}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
            >
              {searching ? "…" : "Tìm"}
            </button>
          </form>
          {searchError && (
            <div className="mt-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
              {searchError}
              <button
                onClick={() => {
                  setSearchError("");
                  void handleSearch(new Event("submit") as unknown as React.FormEvent);
                }}
                className="ml-2 underline"
              >
                Retry
              </button>
            </div>
          )}
          {searchResults.length > 0 && (
            <>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>{selected.size} đã chọn</span>
                <button
                  onClick={handleAddSelected}
                  disabled={selected.size === 0}
                  className="rounded-lg bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  Thêm vào Working Set
                </button>
              </div>
              <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto">
                {searchResults.map((paper) => (
                  <li
                    key={paper.paper_id}
                    className={`rounded-xl border p-3 text-xs transition ${
                      selected.has(paper.paper_id) ? "border-emerald-500 bg-emerald-50" : "border-zinc-200"
                    }`}
                  >
                    <label className="flex cursor-pointer gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(paper.paper_id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(paper.paper_id);
                            else next.delete(paper.paper_id);
                            return next;
                          })
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-medium">{paper.title}</span>
                        <span className="mt-0.5 block text-zinc-500">
                          {paper.authors.slice(0, 3).join(", ")}
                          {paper.year ? ` · ${paper.year}` : ""}
                          {paper.venue ? ` · ${paper.venue}` : ""}
                        </span>
                        <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
                          {paper.source_type === "abstract" ? "có abstract" : "metadata_only"}
                        </span>
                        {paper.doi && <span className="ml-1 text-[10px] text-zinc-400">DOI: {paper.doi}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold">
            Working Set <span className="text-zinc-400">({workingSet.length})</span>
          </h2>
          {workingSet.length === 0 ? (
            <p className="mt-2 text-xs text-zinc-500">
              Chưa có paper. Dùng search ở trên để thêm — Screening và các bước sau cần Working Set.
            </p>
          ) : (
            <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto">
              {workingSet.map((paper) => (
                <li key={paper.paper_id} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs">
                  <span className="line-clamp-2 font-medium">{paper.title}</span>
                  <span className="mt-0.5 block text-zinc-400">
                    {paper.year ?? "n/a"} · {paper.source_type === "abstract" ? "có abstract" : "metadata_only"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400">Đang tải Research Chat…</div>}>
      <ChatInner />
    </Suspense>
  );
}

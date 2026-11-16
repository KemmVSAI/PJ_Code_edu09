"use client";

/**
 * WorkflowPanels — Summary / RAG / Matrix & Draft cho trang Research Chat.
 *
 * Quy tắc PRD v1.1 thể hiện trên UI:
 * - Summary: 5 trường, mỗi trường provenance + not_mentioned; trường thiếu
 *   hiển thị "Không đề cập trong nguồn hiện có"; sửa được từng trường
 *   (PATCH endpoint, giữ provenance gốc — FR-SUMM-05).
 * - RAG: 3 answer_status; citations hiển thị snippet nguyên văn kèm paper;
 *   no_matching_evidence → thông báo corpus không phủ, citations rỗng.
 * - Matrix: một dòng mỗi paper, thiếu → "Not available" (FR-GEN-01).
 * - Draft: claims có support_status; unsupported đếm riêng và cảnh báo —
 *   approval sẽ chặn (FR-GEN-06/11, W5).
 */

import { useState } from "react";
import type { DraftInfo, Paper, RAGResult, SummaryInfo } from "@/lib/api";

const SUMMARY_FIELDS = [
  "Research Objective",
  "Methodology",
  "Dataset",
  "Results",
  "Limitations",
] as const;

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  sufficient_evidence: { label: "Đủ evidence", cls: "bg-emerald-100 text-emerald-800" },
  insufficient_evidence: { label: "Chưa đủ kết luận", cls: "bg-amber-100 text-amber-800" },
  no_matching_evidence: { label: "Không có evidence phù hợp", cls: "bg-zinc-200 text-zinc-700" },
  failed: { label: "RAG lỗi", cls: "bg-red-100 text-red-700" },
  completed: { label: "Hoàn tất", cls: "bg-emerald-100 text-emerald-800" },
  failed_status: { label: "Lỗi", cls: "bg-red-100 text-red-700" },
};

export function SummaryPanel({
  sessionId,
  workingSet,
  summaries,
  onSummarize,
  onEditField,
  busy,
  summarizing,
}: {
  sessionId: string;
  workingSet: Paper[];
  summaries: SummaryInfo[];
  onSummarize: (paperId: string) => void;
  onEditField: (paperId: string, field: string, value: string) => void;
  busy: boolean;
  summarizing: string | null;
}) {
  const [editing, setEditing] = useState<string | null>(null); // "paperId|field"
  const [editValue, setEditValue] = useState("");

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">
        Summary <span className="ml-1 text-xs text-zinc-400">({summaries.length})</span>
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        5 trường, provenance theo từng trường. Paper chưa có summary: bấm “Tóm tắt” — chỉ chạy trên
        paper trong Working Set.
      </p>
      {workingSet.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">
          Chưa có paper trong Working Set.
        </div>
      )}
      <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
        {workingSet.map((paper) => {
          const summary = summaries.find((s) => s.paper_id === paper.paper_id);
          return (
            <div key={paper.paper_id} className="rounded-xl border border-zinc-200 p-3 text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-2 font-medium">{paper.title}</span>
                {!summary || summary.summary_status !== "completed" ? (
                  <button
                    onClick={() => onSummarize(paper.paper_id)}
                    disabled={busy || summarizing !== null || !sessionId}
                    className="shrink-0 rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
                  >
                    {summarizing === paper.paper_id ? "Đang tóm tắt…" : "Tóm tắt"}
                  </button>
                ) : (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                      summary.summary_status === "completed"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {summary.summary_status}
                    {summary.truncated ? " · abstract rút gọn" : ""}
                  </span>
                )}
              </div>
              {summary?.summary_status === "completed" && (
                <div className="mt-2 space-y-1.5">
                  {SUMMARY_FIELDS.map((field) => {
                    const f = summary.fields[field];
                    if (!f) return null;
                    const isEditing = editing === `${paper.paper_id}|${field}`;
                    return (
                      <div key={field} className="rounded-lg bg-zinc-50 px-2.5 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-zinc-700">{field}</span>
                          <span className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                            {f.user_edited && <span className="text-sky-600">đã sửa</span>}
                            <span>nguồn: {f.provenance}</span>
                            <button
                              onClick={() => {
                                setEditing(isEditing ? null : `${paper.paper_id}|${field}`);
                                setEditValue(f.not_mentioned ? "" : f.value);
                              }}
                              className="underline hover:text-zinc-600"
                            >
                              sửa
                            </button>
                          </span>
                        </div>
                        {isEditing ? (
                          <div className="mt-1.5 flex gap-1.5">
                            <input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="flex-1 rounded border border-zinc-300 px-2 py-1"
                              placeholder="Nội dung sửa…"
                            />
                            <button
                              onClick={() => {
                                onEditField(paper.paper_id, field, editValue);
                                setEditing(null);
                              }}
                              className="rounded bg-zinc-900 px-2 py-1 text-[10px] text-white"
                            >
                              Lưu
                            </button>
                          </div>
                        ) : f.not_mentioned ? (
                          <p className="mt-0.5 italic text-zinc-400">{f.value}</p>
                        ) : (
                          <p className="mt-0.5 text-zinc-600">{f.value}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {summary && summary.summary_status !== "completed" && (
                <p className="mt-1.5 text-red-600">
                  Summary lỗi — thử lại (lỗi kỹ thuật, không có dữ liệu giả).
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RagPanel({
  sessionId,
  corpusCount,
  ragHistory,
  onAsk,
  busy,
}: {
  sessionId: string;
  corpusCount: number;
  ragHistory: RAGResult[];
  onAsk: (question: string) => void;
  busy: boolean;
}) {
  const [question, setQuestion] = useState("");
  const last = ragHistory[0];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-sm font-semibold">
        RAG <span className="ml-1 text-xs text-zinc-400">corpus: {corpusCount} paper</span>
      </h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim() && !busy) {
            onAsk(question.trim());
            setQuestion("");
          }
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={corpusCount === 0 ? "Cần Confirmed Corpus trước khi hỏi…" : "Câu hỏi trên corpus…"}
          disabled={busy || corpusCount === 0 || !sessionId}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-xs outline-none focus:border-zinc-900 disabled:bg-zinc-50"
        />
        <button
          type="submit"
          disabled={busy || corpusCount === 0 || !question.trim()}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          Hỏi
        </button>
      </form>
      {last && (
        <div className="mt-3 rounded-xl border border-zinc-200 p-3 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              STATUS_LABELS[last.answer_status]?.cls ?? "bg-zinc-100"
            }`}
          >
            {STATUS_LABELS[last.answer_status]?.label ?? last.answer_status}
          </span>
          <p className="mt-2 whitespace-pre-wrap text-zinc-700">{last.answer}</p>
          {last.citations.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="font-medium text-zinc-500">Evidence (nguyên văn):</p>
              {last.citations.map((c) => (
                <div key={c.chunk_id} className="rounded-lg bg-zinc-50 px-2.5 py-1.5">
                  <p className="italic text-zinc-600">“{c.snippet}”</p>
                  <p className="mt-0.5 text-[10px] text-zinc-400">
                    {c.title} · {c.paper_id} · {c.chunk_id}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-zinc-400">corpus v{last.corpus_version}</p>
        </div>
      )}
      {ragHistory.length > 1 && (
        <p className="mt-2 text-[10px] text-zinc-400">{ragHistory.length} câu hỏi đã lưu trong lịch sử session.</p>
      )}
    </div>
  );
}

export function DraftPanel({
  sessionId,
  draft,
  onGenerate,
  busy,
  generating,
}: {
  sessionId: string;
  draft: DraftInfo | null;
  onGenerate: () => void;
  busy: boolean;
  generating: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Matrix &amp; Draft
          {draft && draft.status && (
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">
              {draft.status} · corpus v{draft.corpus_version}
            </span>
          )}
        </h2>
        <button
          onClick={onGenerate}
          disabled={busy || generating || !sessionId}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          {generating ? "Đang tạo…" : draft?.draft_id ? "Tạo lại" : "Generate"}
        </button>
      </div>

      {!draft?.draft_id ? (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">
          Chưa có draft. Cần Confirmed Corpus (≥1 paper) — Generate tạo Comparison Matrix + Synthesis
          Draft; draft xong sẽ có trên trang Review &amp; Export.
        </div>
      ) : (
        <>
          {draft.unsupported_count > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              ⚠ {draft.unsupported_count} claim không có evidence hỗ trợ — không được xuất hiện trong nội dung được duyệt (FR-GEN-06).
            </p>
          )}
          {/* Comparison Matrix */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[11px]">
              <thead>
                <tr className="bg-zinc-100 text-left">
                  <th className="border border-zinc-200 px-2 py-1">Paper</th>
                  <th className="border border-zinc-200 px-2 py-1">Objective</th>
                  <th className="border border-zinc-200 px-2 py-1">Method</th>
                  <th className="border border-zinc-200 px-2 py-1">Results</th>
                </tr>
              </thead>
              <tbody>
                {draft.matrix.map((row) => (
                  <tr key={String(row.paper_id)}>
                    <td className="border border-zinc-200 px-2 py-1">
                      <span className="block font-medium">{String(row.title).slice(0, 60)}</span>
                      <span className="text-zinc-400">
                        {String(row.year)} · {String(row.source_type)}
                      </span>
                    </td>
                    <td className="border border-zinc-200 px-2 py-1">{String(row["Research Objective"])}</td>
                    <td className="border border-zinc-200 px-2 py-1">{String(row.Methodology)}</td>
                    <td className="border border-zinc-200 px-2 py-1">{String(row.Results)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Draft */}
          <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-[11px] leading-relaxed text-zinc-700">
            {draft.content}
          </pre>
          {/* Claims */}
          {draft.claims.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-zinc-500">Claims ({draft.claims.length})</p>
              {draft.claims.map((c, i) => (
                <div key={i} className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                        c.support_status === "supported"
                          ? "bg-emerald-100 text-emerald-800"
                          : c.support_status === "partially_supported"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {c.support_status}
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 text-[9px] text-zinc-500">{c.claim_type}</span>
                  </div>
                  <p className="mt-1 text-zinc-600">{c.claim_text}</p>
                  {c.paper_ids.length > 0 && (
                    <p className="mt-0.5 text-[10px] text-zinc-400">nguồn: {c.paper_ids.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

/**
 * Dashboard — trang 1/3.
 * Chức năng (theo yêu cầu): Research Sessions, project gần đây,
 * tạo phiên nghiên cứu mới.
 *
 * - Tổng quan tiến độ từng session: Working Set / Confirmed Corpus /
 *   draft status (từ GET /sessions — backend trả kèm counts).
 * - Bấm vào session → Research Chat; draft có sẵn →shortcut sang Review & Export.
 * - Empty states theo docs/ui-flow.md; lỗi backend hiển thị retry.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession, listSessions, type SessionInfo } from "@/lib/api";

const DRAFT_BADGE: Record<string, { label: string; cls: string }> = {
  Draft: { label: "Có bản nháp", cls: "bg-zinc-100 text-zinc-600" },
  "Pending Review": { label: "Nháp chờ duyệt", cls: "bg-amber-100 text-amber-800" },
  Approved: { label: "Đã phê duyệt", cls: "bg-emerald-100 text-emerald-800" },
  Stale: { label: "Nháp lỗi thời", cls: "bg-red-100 text-red-700" },
};

function SessionRow({ s }: { s: SessionInfo }) {
  const draft = s.draft_status ? DRAFT_BADGE[s.draft_status] : null;
  const progressSteps = [
    { label: "Working Set", count: s.papers_count ?? 0 },
    { label: "Corpus", count: s.corpus_count ?? 0 },
  ];

  return (
    <li className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-400 hover:bg-zinc-50">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/chat?session=${s.session_id}`} className="min-w-0 flex-1">
          <span className="line-clamp-2 font-medium">{s.research_question}</span>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {progressSteps.map((step) => (
              <span key={step.label} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-600">
                {step.label}: <span className="font-semibold">{step.count}</span>
              </span>
            ))}
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-zinc-600">corpus v{s.corpus_version}</span>
            {draft && <span className={`rounded-full px-2.5 py-0.5 ${draft.cls}`}>{draft.label}</span>}
          </div>
          <time className="mt-1.5 block text-xs text-zinc-400">
            Cập nhật {new Date(s.updated_at ?? s.created_at).toLocaleString("vi-VN")}
          </time>
        </Link>
        {s.draft_status && (
          <Link
            href={`/review?session=${s.session_id}`}
            className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-500 hover:bg-white"
          >
            Review &amp; Export
          </Link>
        )}
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [question, setQuestion] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSessions();
      setSessions(data);
      setLoading(false);
    } catch {
      setError("Không tải được danh sách session — kiểm tra backend đang chạy ở :8000");
      setLoading(false);
    }
  }, []);

  // Lần đầu mount: fetch trong effect qua async IIFE — setState chỉ chạy sau
  // khi promise resolve (không phải đồng bộ trong body effect).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listSessions();
        if (!cancelled) setSessions(data);
      } catch {
        if (!cancelled)
          setError("Không tải được danh sách session — kiểm tra backend đang chạy ở :8000");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setCreating(true);
    setError("");
    try {
      const session = await createSession(question.trim());
      router.push(`/chat?session=${session.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo session thất bại");
    } finally {
      setCreating(false);
    }
  }

  const totalPapers = sessions.reduce((sum, s) => sum + (s.papers_count ?? 0), 0);
  const totalCorpus = sessions.reduce((sum, s) => sum + (s.corpus_count ?? 0), 0);
  const draftsReady = sessions.filter((s) => s.draft_status).length;

  return (
    <div className="space-y-6">
      {/* Tạo phiên mới */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Tạo phiên nghiên cứu mới</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Nhập Research Question — hệ thống sẽ tìm bài báo từ OpenAlex, sàng lọc và tổng hợp theo evidence.
        </p>
        <form onSubmit={handleCreate} className="mt-4 flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ví dụ: RAG giảm hallucination trong hệ thống hỏi đáp tài liệu như thế nào?"
            className="flex-1 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-zinc-900"
            maxLength={5000}
          />
          <button
            type="submit"
            disabled={creating || !question.trim()}
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
          >
            {creating ? "Đang tạo…" : "Tạo phiên"}
          </button>
        </form>
        {error && (
          <p className="mt-2 text-sm text-red-600">
            {error}
            <button onClick={refresh} className="ml-2 underline">
              Thử lại
            </button>
          </p>
        )}
      </section>

      {/* Tổng quan */}
      {!loading && sessions.length > 0 && (
        <section className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-400">Phiên nghiên cứu</p>
            <p className="mt-1 text-2xl font-semibold">{sessions.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-400">Paper trong Working Set</p>
            <p className="mt-1 text-2xl font-semibold">{totalPapers}</p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wider text-zinc-400">Confirmed Corpus</p>
            <p className="mt-1 text-2xl font-semibold">{totalCorpus}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{draftsReady} session có draft</p>
          </div>
        </section>
      )}

      {/* Danh sách session */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Research Sessions gần đây</h2>
          <div className="flex items-center gap-3">
            {loading && <span className="text-sm text-zinc-400">Đang tải…</span>}
            {!loading && (
              <button onClick={refresh} className="text-xs text-zinc-500 underline hover:text-zinc-700">
                Làm mới
              </button>
            )}
          </div>
        </div>
        {!loading && sessions.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
            Chưa có phiên nào. Nhập Research Question ở trên để bắt đầu — hệ thống chỉ dùng
            <span className="mx-1 font-medium">metadata và abstract</span>
            từ OpenAlex, không xử lý full-text PDF.
          </div>
        )}
        <ul className="mt-4 space-y-2">
          {sessions.map((s) => (
            <SessionRow key={s.session_id} s={s} />
          ))}
        </ul>
      </section>
    </div>
  );
}

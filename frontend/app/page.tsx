"use client";

/**
 * Dashboard — trang 1/3.
 * Chức năng: Research Sessions gần đây, tạo phiên nghiên cứu mới.
 * Theo PRD US-01 + ui-flow "Trạng thái rỗng": session mới hướng dẫn nhập
 * Research Question. Bấm vào session → mở Research Chat (trang 2).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSession, listSessions, type SessionInfo } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [question, setQuestion] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() => setError("Không tải được danh sách session — kiểm tra backend đang chạy ở :8000"))
      .finally(() => setLoading(false));
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

  return (
    <div className="space-y-6">
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
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Research Sessions gần đây</h2>
          {loading && <span className="text-sm text-zinc-400">Đang tải…</span>}
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
            <li key={s.session_id}>
              <Link
                href={`/chat?session=${s.session_id}`}
                className="block rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-400 hover:bg-zinc-50"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="line-clamp-1 font-medium">{s.research_question}</span>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">
                    corpus v{s.corpus_version}
                  </span>
                </div>
                <time className="mt-1 block text-xs text-zinc-400">
                  {new Date(s.created_at).toLocaleString("vi-VN")}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

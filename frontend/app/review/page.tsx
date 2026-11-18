"use client";

/**
 * Review & Export — trang 3/3 (W5).
 *
 * Chức năng theo yêu cầu: Researcher và Reviewer kiểm tra claim, citation,
 * evidence; chỉnh sửa; approve và export DOCX.
 *
 * Quy tắc PRD v1.1 mục 11.2 thể hiện trên UI:
 * - Draft + claims hiển thị để kiểm tra (claim_type, support_status, paper_ids).
 * - Approve → tạo Approval Snapshot bất biến (FR-APR-02); chặn khi còn
 *   claim unsupported (FR-APR-09, lỗi 422 hiển thị rõ).
 * - Sửa draft sau approve → reset Pending Review + invalidate approval (FR-APR-03/07).
 * - Export DOCX chỉ khả dụng khi Approved + snapshot Active + corpus version
 *   khớp (FR-APR-04); file sinh từ snapshot, kèm Export Record (FR-APR-05).
 * - Export history hiển thị theo approval.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  approveDraft,
  downloadDocx,
  exportDocx,
  getApproval,
  getCorpus,
  getDraft,
  getExportHistory,
  listSessions,
  type ApprovalInfo,
  type DraftInfo,
  type ExportRecord,
  type Paper,
  type SessionInfo,
} from "@/lib/api";

const SUPPORT_STYLES: Record<string, { label: string; cls: string }> = {
  supported: { label: "supported", cls: "bg-emerald-100 text-emerald-800" },
  partially_supported: { label: "partially supported", cls: "bg-amber-100 text-amber-800" },
  unsupported: { label: "unsupported", cls: "bg-red-100 text-red-700" },
};

function ReviewInner() {
  const searchParams = useSearchParams();
  const initialSession = searchParams.get("session") ?? "";

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionId, setSessionId] = useState(initialSession);
  const [workingSet, setWorkingSet] = useState<Paper[]>([]);
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  const [draftText, setDraftText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [approval, setApproval] = useState<ApprovalInfo | null>(null);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDraft = useCallback(
    async (sid: string) => {
      const d = await getDraft(sid);
      if (d.generation_status === "no_draft" || !d.draft_id) {
        setDraft(null);
        setDraftText("");
        setApproval(null);
        setExports([]);
        return;
      }
      setDraft(d);
      setDraftText(d.content);
      setDirty(false);
      const ap = await getApproval(sid, d.draft_id).catch(() => null);
      // approval chỉ hợp lệ nếu hash khớp draft hiện hành (FR-APR-04b)
      setApproval(ap && ap.status === "Active" ? ap : null);
      if (ap && ap.status === "Active") {
        setExports(await getExportHistory(sid, ap.approval_id).catch(() => []));
      } else {
        setExports([]);
      }
    },
    [],
  );

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch(() => setError("Không tải được session — kiểm tra backend ở :8000"));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const papers = await getCorpus(sessionId).catch(() => []);
        if (!cancelled) setWorkingSet(papers);
        await loadDraft(sessionId);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, loadDraft]);

  async function handleApprove() {
    if (!draft?.draft_id || !sessionId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const ap = await approveDraft(sessionId, draft.draft_id);
      setApproval(ap);
      setDirty(false);
      setMessage(
        `Đã phê duyệt — Approval Snapshot #${ap.approval_id} (hash ${ap.approved_content_hash.slice(0, 12)}…, corpus v${ap.approved_corpus_version}).`,
      );
      setDraft((d) => (d ? { ...d, status: "Approved" } : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve thất bại");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!draft?.draft_id || !sessionId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await exportDocx(sessionId, draft.draft_id);
      downloadDocx(result);
      setExports(await getExportHistory(sessionId, result.approval_id));
      setMessage(
        `Đã xuất ${result.file_name} (export #${result.export_id}, file hash ${result.export_file_hash.slice(0, 12)}…).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export thất bại");
    } finally {
      setBusy(false);
    }
  }

  const isApproved = approval !== null && !dirty && draft?.status === "Approved";
  const unsupportedCount = draft?.unsupported_count ?? 0;
  const claims = draft?.claims ?? [];

  return (
    <div className="space-y-4">
      {/* Header + session picker */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Review &amp; Export</h1>
            <p className="text-sm text-zinc-500">
              Kiểm tra claim, citation và evidence trước khi phê duyệt và xuất DOCX.
            </p>
          </div>
          <select
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">— Chọn session —</option>
            {sessions.map((s) => (
              <option key={s.session_id} value={s.session_id}>
                {s.research_question.slice(0, 60)}
              </option>
            ))}
          </select>
        </div>
        {!sessionId && (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
            Chọn một Research Session để review. Chưa có?{" "}
            <Link href="/" className="underline">
              Tạo tại Dashboard
            </Link>{" "}
            hoặc làm việc trong <Link href="/chat" className="underline">Research Chat</Link> trước.
          </div>
        )}
      </section>

      {sessionId && (
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            {/* Trạng thái approval */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  Trạng thái phê duyệt
                  {draft && (
                    <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">
                      {draft.status} · corpus v{draft.corpus_version}
                    </span>
                  )}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={busy || !draft?.draft_id || unsupportedCount > 0}
                    title={
                      unsupportedCount > 0
                        ? "Draft còn claim unsupported — không thể duyệt (FR-APR-09)"
                        : "Tạo Approval Snapshot bất biến"
                    }
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {approval && !dirty ? `Approved ✓ (#${approval.approval_id})` : "Approve"}
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={busy || !isApproved}
                    title={
                      isApproved
                        ? "Sinh DOCX từ Approval Snapshot"
                        : "Chỉ export sau khi Approve (FR-APR-04)"
                    }
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Export DOCX
                  </button>
                </div>
              </div>
              {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
              {unsupportedCount > 0 && (
                <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  ⚠ Draft còn {unsupportedCount} claim unsupported — Approve bị chặn theo FR-APR-09.
                  Sửa hoặc loại bỏ các claim này trong Research Chat trước.
                </p>
              )}
              {dirty && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Draft đã sửa chưa lưu vào hệ thống — nội dung chỉnh trên trang này là bản xem trước.
                  Approve áp dụng cho nội dung draft hiện hành từ Research Chat.
                </p>
              )}
              {approval && !dirty && (
                <p className="mt-2 text-xs text-zinc-500">
                  Snapshot #{approval.approval_id} · hash {approval.approved_content_hash.slice(0, 16)}… · corpus
                  v{approval.approved_corpus_version} · duyệt lúc{" "}
                  {new Date(approval.approved_at).toLocaleString("vi-VN")}
                </p>
              )}
            </section>

            {/* Draft + claims */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Literature Review Draft</h2>
              {!draft?.draft_id ? (
                <div className="mt-3 rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
                  Chưa có draft — cần Confirmed Corpus rồi Generate trong{" "}
                  <Link href={`/chat?session=${sessionId}`} className="underline">
                    Research Chat
                  </Link>
                  .
                </div>
              ) : (
                <>
                  <pre className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-700">
                    {draftText}
                  </pre>
                  <p className="mt-2 text-xs text-zinc-400">
                    Claims ({claims.length}) — kiểm tra từng claim trước khi duyệt:
                  </p>
                  <div className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1">
                    {claims.map((c, i) => {
                      const style = SUPPORT_STYLES[c.support_status] ?? SUPPORT_STYLES.unsupported;
                      return (
                        <div key={i} className="rounded-xl border border-zinc-200 p-3 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${style.cls}`}>
                              {style.label}
                            </span>
                            <span className="rounded bg-zinc-100 px-1.5 text-[10px] text-zinc-500">
                              {c.claim_type}
                            </span>
                          </div>
                          <p className="mt-1.5 text-zinc-700">{c.claim_text}</p>
                          {c.paper_ids.length > 0 && (
                            <p className="mt-1 text-[10px] text-zinc-400">
                              Nguồn: {c.paper_ids.join(", ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          </div>

          {/* Nguồn đối chiếu + export history */}
          <aside className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold">
                Confirmed Corpus <span className="text-zinc-400">({workingSet.length})</span>
              </h2>
              {workingSet.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">Corpus rỗng — session chưa review paper nào.</p>
              ) : (
                <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
                  {workingSet.map((paper) => (
                    <li key={paper.paper_id} className="rounded-lg border border-zinc-200 px-3 py-2 text-xs">
                      <span className="line-clamp-2 font-medium">{paper.title}</span>
                      <span className="mt-0.5 block text-zinc-400">
                        {paper.year ?? "n/a"} · {paper.source_type === "abstract" ? "có abstract" : "metadata_only"}
                        {paper.doi ? ` · DOI ${paper.doi}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {exports.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <h2 className="text-sm font-semibold">Lịch sử Export</h2>
                <ul className="mt-2 space-y-1.5 text-xs">
                  {exports.map((ex) => (
                    <li key={ex.export_id} className="rounded-lg border border-zinc-200 px-3 py-2">
                      <span className="font-medium">#{ex.export_id}</span> {ex.file_name}
                      <span className="mt-0.5 block text-[10px] text-zinc-400">
                        hash {ex.export_file_hash.slice(0, 12)}… ·{" "}
                        {new Date(ex.exported_at).toLocaleString("vi-VN")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-600">
              <h2 className="text-sm font-semibold text-zinc-900">Quy tắc duyệt (PRD)</h2>
              <ul className="mt-2 space-y-1.5">
                <li>Approval tạo snapshot bất biến + content hash + corpus version.</li>
                <li>Sửa draft đã duyệt → reset Pending Review, approval invalidated.</li>
                <li>DOCX chỉ sinh từ snapshot — không gọi LLM lúc export.</li>
                <li>Claim unsupported/partially chưa xử lý chặn approval.</li>
                <li>Corpus đổi → approval invalidated, phải rebuild + duyệt lại.</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400">Đang tải Review &amp; Export…</div>}>
      <ReviewInner />
    </Suspense>
  );
}

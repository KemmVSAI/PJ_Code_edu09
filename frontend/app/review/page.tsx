"use client";

/**
 * Review & Export — trang 3/3.
 * Chức năng: Researcher và Reviewer kiểm tra claim, citation, evidence,
 * chỉnh sửa, approve và export DOCX.
 *
 * Backend W1 chưa có draft/approval endpoint (W4–W5) — trang hiện:
 * - Session picker + Working Set để đối chiếu nguồn.
 * - Khu vực draft kiểm tra với trạng thái rỗng đúng ui-flow
 *   ("Draft rỗng: giải thích cần corpus đã xác nhận trước khi Generate").
 * - Nút Approve / Export disable đến khi có draft hợp lệ (FR-APR-04).
 * State đã đặt sẵn để nối endpoint W4–W5 mà không đổi layout.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getWorkingSet, listSessions, type Paper, type SessionInfo } from "@/lib/api";

const CLAIM_CHECKLIST = [
  "Mọi claim có citation và evidence truy xuất được",
  "Claim unsupported không xuất hiện trong nội dung duyệt",
  "Claim partially_supported đã được thu hẹp theo evidence",
  "References lấy từ Paper Metadata, trường thiếu hiển thị 'not available'",
];

function ReviewInner() {
  const searchParams = useSearchParams();
  const initialSession = searchParams.get("session") ?? "";

  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionId, setSessionId] = useState(initialSession);
  const [workingSet, setWorkingSet] = useState<Paper[]>([]);
  const [draftText, setDraftText] = useState("");
  const [approved, setApproved] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    listSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    getWorkingSet(sessionId)
      .then((papers) => {
        setWorkingSet(papers);
        setApproved(false); // đổi session → approval chưa hợp lệ cho draft mới
      })
      .catch(() => setWorkingSet([]));
  }, [sessionId]);

  const hasDraft = draftText.trim().length > 0;

  return (
    <div className="space-y-4">
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
            Chọn một Research Session để review. Chưa có session?{" "}
            <Link href="/" className="underline">
              Tạo tại Dashboard
            </Link>{" "}
            hoặc làm việc trong <Link href="/chat" className="underline">Research Chat</Link> trước.
          </div>
        )}
      </section>

      {sessionId && (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <section className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Literature Review Draft</h2>
              {!hasDraft && (
                <div className="mt-3 rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">
                  Draft rỗng — cần Confirmed Corpus đã xác nhận trong Research Chat trước khi Generate.
                  Sau khi có draft, claim/citation/evidence sẽ hiện tại đây để kiểm tra.
                </div>
              )}
              <textarea
                value={draftText}
                onChange={(e) => {
                  setDraftText(e.target.value);
                  setApproved(false); // mọi thay đổi nội dung → approval reset (FR-APR-03)
                }}
                placeholder="Nội dung draft sẽ hiện ở đây sau khi Generate trong Research Chat. Có thể chỉnh sửa trực tiếp."
                rows={14}
                className="mt-3 w-full rounded-xl border border-zinc-300 p-4 text-sm outline-none focus:border-zinc-900"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => {
                    if (!hasDraft) {
                      setMessage("Draft rỗng — không thể approve nội dung trống.");
                      return;
                    }
                    setApproved(true);
                    setMessage("Đã phê duyệt. Chỉnh sửa tiếp sẽ reset approval (FR-APR-03).");
                  }}
                  disabled={!hasDraft}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  {approved ? "Approved ✓" : "Approve"}
                </button>
                <button
                  onClick={() => {
                    if (!approved) {
                      setMessage("Export chỉ khả dụng sau khi Approve (FR-APR-04).");
                      return;
                    }
                    setMessage(
                      "Backend W5 sẽ sinh DOCX từ Approval Snapshot kèm Export Record. Chức năng nối endpoint khi triển khai W5.",
                    );
                  }}
                  disabled={!approved}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
                >
                  Export DOCX
                </button>
                {message && <span className="text-xs text-zinc-500">{message}</span>}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold">Claim checklist trước khi duyệt</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-zinc-600">
                {CLAIM_CHECKLIST.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-zinc-400">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold">
                Working Set <span className="text-zinc-400">({workingSet.length})</span>
              </h2>
              {workingSet.length === 0 ? (
                <p className="mt-2 text-xs text-zinc-500">Session này chưa có paper.</p>
              ) : (
                <ul className="mt-2 max-h-80 space-y-1.5 overflow-y-auto">
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-600">
              <h2 className="text-sm font-semibold text-zinc-900">Quy tắc duyệt (PRD)</h2>
              <ul className="mt-2 space-y-1.5">
                <li>Approval lưu snapshot bất biến + content hash + corpus version.</li>
                <li>Sửa draft đã duyệt → reset về Pending Review.</li>
                <li>DOCX chỉ sinh từ approved snapshot, không gọi LLM lúc export.</li>
                <li>Claim unsupported/partially chưa xử lý chặn approval.</li>
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

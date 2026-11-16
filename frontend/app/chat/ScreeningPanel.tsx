"use client";

/**
 * ScreeningPanel — kết quả Smart Screening + quyết định Accept/Reject/Override.
 *
 * Quy tắc PRD v1.1 mục 11.2 thể hiện trên UI:
 * - Mỗi paper hiện ai_classification + reason + evidence (snippet nguyên văn).
 * - classification_status khác completed → trạng thái lỗi riêng, không nhãn nghiệp vụ.
 * - Insufficient Evidence: KHÔNG có nút Accept; chỉ Reject / Override.
 * - Override mở ô chọn final_classification (3 nhãn judged) + override_note.
 * - Mỗi thay đổi membership làm corpus_version tăng → hiển thị badge.
 */

import { useState } from "react";
import {
  submitReviewDecision,
  type ScreeningItem,
  type ScreeningLabel,
} from "@/lib/api";

const LABEL_STYLES: Record<string, string> = {
  Relevant: "bg-emerald-100 text-emerald-800",
  "Partially Relevant": "bg-amber-100 text-amber-800",
  "Not Relevant": "bg-red-100 text-red-700",
  "Insufficient Evidence": "bg-zinc-200 text-zinc-700",
};

const REVIEW_STYLES: Record<string, string> = {
  Accepted: "border-emerald-400 bg-emerald-50",
  Rejected: "border-red-300 bg-red-50 opacity-70",
  Overridden: "border-sky-400 bg-sky-50",
};

function StatusBadge({ item }: { item: ScreeningItem }) {
  if (item.classification_status === "completed" && item.ai_classification) {
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${LABEL_STYLES[item.ai_classification]}`}>
        {item.ai_classification}
      </span>
    );
  }
  if (item.classification_status === "failed" || item.classification_status === "timeout") {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        Lỗi kỹ thuật ({item.classification_status})
      </span>
    );
  }
  return <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500">{item.classification_status}</span>;
}

function ScreenCard({
  item,
  sessionId,
  onDecided,
}: {
  item: ScreeningItem;
  sessionId: string;
  onDecided: (msg: string) => void;
}) {
  const [overriding, setOverriding] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const judged: ScreeningLabel[] = ["Relevant", "Partially Relevant", "Not Relevant"];
  const canAccept = item.ai_classification !== null && item.ai_classification !== "Insufficient Evidence";
  const decided = item.review_status !== "Pending Review";

  async function decide(decision: "accept" | "reject" | "override", final?: ScreeningLabel) {
    setBusy(true);
    setError("");
    try {
      const resp = await submitReviewDecision(sessionId, item.paper_id, decision, final, note);
      onDecided(
        `${item.title.slice(0, 60)} → ${resp.review_status}${resp.final_classification ? ` (${resp.final_classification})` : ""} · corpus v${resp.corpus_version}${resp.in_corpus ? " · đã vào Confirmed Corpus" : ""}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại");
    } finally {
      setBusy(false);
      setOverriding(false);
    }
  }

  return (
    <li className={`rounded-xl border p-3.5 text-sm ${decided ? REVIEW_STYLES[item.review_status] : "border-zinc-200 bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium">{item.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge item={item} />
            {decided && (
              <span className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600">
                {item.review_status}
                {item.final_classification ? ` → ${item.final_classification}` : ""}
              </span>
            )}
            {item.ai_classification && item.final_classification && item.ai_classification !== item.final_classification && (
              <span className="text-xs text-zinc-400">
                AI: {item.ai_classification} (giữ nguyên, không ghi đè)
              </span>
            )}
          </div>
        </div>
      </div>

      {item.reason && <p className="mt-2 text-xs text-zinc-600"><span className="font-medium">Lý do:</span> {item.reason}</p>}
      {item.evidence?.snippet && (
        <p className="mt-1.5 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs italic text-zinc-500">
          “{item.evidence.snippet}”
          <span className="ml-1 not-italic text-zinc-400">— {item.evidence.source_type}</span>
        </p>
      )}
      {item.classification_error && <p className="mt-1.5 text-xs text-red-600">{item.classification_error}</p>}
      {item.override_note && <p className="mt-1.5 text-xs text-sky-700">Ghi đè vì: {item.override_note}</p>}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

      {!decided && item.classification_status === "completed" && (
        <div className="mt-2.5">
          {!overriding ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => decide("accept")}
                disabled={busy || !canAccept}
                title={canAccept ? "Chấp nhận phân loại AI" : "Insufficient Evidence không thể Accept trực tiếp"}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Accept
              </button>
              <button
                onClick={() => decide("reject")}
                disabled={busy}
                className="rounded-lg bg-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-400 disabled:opacity-40"
              >
                Reject
              </button>
              <button
                onClick={() => setOverriding(true)}
                disabled={busy}
                className="rounded-lg border border-sky-500 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-40"
              >
                Override
              </button>
            </div>
          ) : (
            <div className="mt-2 space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-2.5">
              <p className="text-xs text-sky-800">Chọn phân loại cuối — phân loại AI sẽ được giữ nguyên:</p>
              <div className="flex flex-wrap gap-1.5">
                {judged.map((label) => (
                  <button
                    key={label}
                    onClick={() => decide("override", label)}
                    disabled={busy}
                    className="rounded-lg border border-sky-500 bg-white px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-40"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Lý do ghi đè (tùy chọn)"
                className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs"
              />
              <button onClick={() => setOverriding(false)} disabled={busy} className="text-xs text-zinc-500 underline">
                Hủy
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function ScreeningPanel({
  sessionId,
  items,
  corpusVersion,
  corpusCount,
  onScreen,
  onDecided,
  screening,
}: {
  sessionId: string;
  items: ScreeningItem[];
  corpusVersion: number;
  corpusCount: number;
  onScreen: () => void;
  onDecided: (msg: string) => void;
  screening: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Screening
          <span className="ml-2 text-xs text-zinc-400">{items.length} kết quả</span>
        </h2>
        <button
          onClick={onScreen}
          disabled={screening || !sessionId}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
        >
          {screening ? "Đang phân loại…" : "Chạy Screening"}
        </button>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Confirmed Corpus: <span className="font-medium text-zinc-700">{corpusCount} paper</span> · corpus v{corpusVersion}
        {" — "}chỉ Accepted/Overridden với Relevant/Partially Relevant vào corpus.
      </p>

      {items.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-300 p-5 text-center text-xs text-zinc-500">
          Chưa có kết quả screening. Thêm paper vào Working Set rồi bấm “Chạy Screening” — AI sẽ đề xuất
          mức độ liên quan kèm lý do; bạn quyết định Accept / Reject / Override.
        </div>
      ) : (
        <ul className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <ScreenCard key={item.paper_id} item={item} sessionId={sessionId} onDecided={onDecided} />
          ))}
        </ul>
      )}
    </div>
  );
}

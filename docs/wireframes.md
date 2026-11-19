# LitReview Agent — Wireframe chi tiết (AI-generated)

> **Trạng thái:** Bản wireframe text-based cho Gate 1, soạn bởi AI từ PRD v1.1
> (`docs/prd.md`) và UI Flow (`docs/ui-flow.md`). Thể hiện layout từng màn hình,
> component chính, trạng thái và luồng dữ liệu. Minh chứng bổ sung cho mục
> "Wireframe / UI Flow" trong `docs/gate-1.md`.

> **Ký hiệu:** `[Button]` = nút · `(input)` = ô nhập · `[x]` checkbox ·
> `(▾)` dropdown · **Bold** = heading · `└─` = phụ thuộc dữ liệu

---

## M1. Dashboard — `/`

**Mục đích:** điểm khởi đầu — tạo phiên, xem tiến độ, mở lại session.

```text
┌──────────────────────────────────────────────────────────────────┐
│ [EDU-09] LitReview Agent      Dashboard | Research Chat | Review │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Tạo phiên nghiên cứu mới                                        │
│  Nhập Research Question — hệ thống sẽ tìm bài từ OpenAlex…       │
│  ┌──────────────────────────────────────────────────┐ [Tạo phiên]│
│  │ (Ví dụ: RAG giảm hallucination như thế nào?)     │            │
│  └──────────────────────────────────────────────────┘            │
│  ⚠ {lỗi network} [Thử lại]                                       │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                 │
│  │ PHIÊN       │ │ WORKING SET │ │ CONFIRMED   │                 │
│  │ {n}         │ │ {tổng}      │ │ CORPUS {n}  │                 │
│  │             │ │             │ │ {k} có draft│                 │
│  └─────────────┘ └─────────────┘ └─────────────┘                 │
│                                                                  │
│  Research Sessions gần đây                          [Làm mới]    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ RAG giảm hallucination như thế nào?                        │  │
│  │ Working Set: 3 · Corpus: 2 · corpus v4  [Nháp chờ duyệt]   │  │
│  │ Cập nhật 17/11 20:14                        → Mở Chat      │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Screening context cho SLR                                  │  │
│  │ Working Set: 0 · Corpus: 0 · corpus v1                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│  (rỗng → "Chưa có phiên nào. Nhập Research Question ở trên…")    │
└──────────────────────────────────────────────────────────────────┘
```

**Thành phần + dữ liệu:**

| Component | Nguồn | Ghi chú |
|---|---|---|
| Thẻ tạo phiên | `POST /sessions` | redirect → `/chat?session={id}` |
| 3 thẻ stats | `GET /sessions` tổng hợp | papers_count, corpus_count |
| Session row | `GET /sessions` | badge draft: Nháp chờ duyệt (vàng) / Đã phê duyệt (xanh) / Nháp lỗi thời (đỏ) |
| Nút "Review & Export" | hiện khi `draft_status` có giá trị | → `/review?session={id}` |

---

## M2. Research Chat — `/chat?session={id}`

**Mục đích:** không gian làm việc chính — hội thoại + 6 công cụ + panel dữ liệu.

**Layout 3 cột:**

```text
┌──────────┬──────────────────────────────────┬─────────────────────┐
│ TOOL RAIL│  HỘI THOẠI                       │ SEARCH & WORKING SET│
├──────────┼──────────────────────────────────┼─────────────────────┤
│ WORKFLOW │ Session: {id}                    │ Tìm bài (OpenAlex)  │
│ ┌──────┐ │                                  │ ┌───────┐ [Tìm]    │
│ │Search│ │ ┌─────────────────────────────┐  │ └───────┘          │
│ ├──────┤ │ │ (system) RQ: ...            │  │ ☑ RAG for NLP      │
│ │Screen│ │ ┌─────────────────────────────┐  │   có abstract      │
│ ├──────┤ │ │ [user] Câu hỏi…             │  │ ☑ Survey Halluc.   │
│ │Summar│ │ │ [assistant] Trả lời…        │  │   metadata_only    │
│ ├──────┤ │ │   └ tool trace (mờ)         │  │ [Thêm vào Working  │
│ │RAG   │ │ ┌─────────────────────────────┐  │  Set]              │
│ ├──────┤ │ │ ⚠ [CẦN PHÊ DUYỆT] send_email│  │                    │
│ │Matrix│ │ │ [Approve] [Reject]          │  │ WORKING SET (2)    │
│ ├──────┤ │ └─────────────────────────────┘  │ ├ RAG for NLP      │
│ │Draft │ │ (typing…) ● ● ●                  │ ├ Survey Halluc.    │
│ └──────┘ │                                  │                    │
│          │ ┌──────────────────────┐ [Gửi]   │ ══ SCREENING ══    │
│ Quy trình│ │ (Nhập câu hỏi…)      │         │ ├ W1 [Relevant]    │
│ Search→  │ └──────────────────────┘         │ │ reason + evidence│
│ Screen→  │                                  │ │ [Accept][Reject] │
│ Corpus→  │                                  │ │ [Override]       │
│ Summary/ │                                  │ ├ W2 [Partially]   │
│ RAG/…    │                                  │ │ …                │
└──────────┴──────────────────────────────────┴─────────────────────┘
```

### M2.1. Tool Rail (trái) — 6 công cụ theo thứ tự workflow

| Nút | Điều kiện bật | Hành động |
|---|---|---|
| Search | luôn bật | focus panel search bên phải |
| Screening | Working Set ≠ ∅ | `POST /screen` (batch 10) |
| Summary | Working Set ≠ ∅ | `POST /summary` từng paper |
| RAG | Confirmed Corpus ≠ ∅ | dialog nhập câu hỏi → `POST /rag` |
| Comparison Matrix | Corpus ≠ ∅ | `POST /generate` |
| Generate Draft | Corpus ≠ ∅ | `POST /generate` |

### M2.2. Panel Screening (phải, dưới Working Set)

```text
═══ SCREENING ══════════════ [Chạy Screening] ──
Confirmed Corpus: 2 paper · corpus v3

┌─ W10000001 ────────────────────────────────┐
│ [Relevant]                    [Accepted]   │
│ Lý do: khớp chủ đề RAG…                    │
│ ❝ RAG combines retrieval with generation ❞ │
│   — abstract                               │
│ [Accept] [Reject] [Override]               │
└────────────────────────────────────────────┘
┌─ W10000002 ────────────────────────────────┐
│ [Insufficient Evidence]   [Pending Review] │
│ hiển thị "không đủ thông tin để đánh giá"  │
│ ❌ KHÔNG có nút Accept (FR-SCRN-05)        │
│ [Reject] [Override → chọn 3 nhãn + note]   │
└────────────────────────────────────────────┘
```

**Override mở panel con:** chọn 1 trong 3 nhãn judged + ô `override_note`.
Nhãn AI **luôn hiển thị** kèm ghi chú "(giữ nguyên, không ghi đè)".

**Trạng thái lỗi kỹ thuật:** badge đỏ `Lỗi kỹ thuật (failed)` + `classification_error` + nút Retry — **không** biến thành nhãn nghiệp vụ (FR-SCRN-08).

### M2.3. Panel Summary

```text
═══ SUMMARY (2) ═════════════════════════════
┌─ RAG for Knowledge-Intensive NLP ─────────┐
│ status: [completed] · abstract rút gọn ⚠ │
│ ┌ Research Objective ──────────────────┐  │
│ │ Combines retrieval with synthesis    │  │
│ │              nguồn: abstract  [sửa]  │  │
│ ┌ Methodology ─────────────────────────┐  │
│ │ Không đề cập trong nguồn hiện có     │  │
│ │              nguồn: abstract  [sửa]  │  │
│ └ (4 trường còn lại tương tự) ────────┘  │
└──────────────────────────────────────────┘
```

- `[sửa]` → inline input + `[Lưu]` → `PATCH /sessions/{id}/papers/{pid}/summary`
- Trường sửa tay: cờ "đã sửa" (xanh), provenance giữ nguyên (FR-SUMM-05)
- `not_mentioned=true` → text nghiêng, KHÔNG suy diễn (FR-SUMM-02)

### M2.4. Panel RAG

```text
═══ RAG ══ corpus: 2 paper ══════════════════
┌────────────────────┐ [Hỏi]
│ (Câu hỏi trên      │
│  corpus…)          │
└────────────────────┘
┌─ Câu trả lời gần nhất ────────────────────┐
│ [Đủ evidence] (xanh)                      │
│ RAG combines retrieval with synthesis     │
│ … [W10000001_c1]                          │
│ ┌ Evidence (nguyên văn) ────────────────┐ │
│ │ ❝ Retrieval-augmented generation      │ │
│ │   combines retrieval with ❞           │ │
│ │ W10000001 · W10000001_c1              │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

Badge `answer_status`: Đủ evidence (xanh) / Chưa đủ kết luận (vàng) / Không có evidence (xám). `no_matching_evidence` → citations rỗng + thông báo corpus không phủ (FR-RAG-08).

### M2.5. Panel Matrix & Draft

```text
═══ MATRIX & DRAFT ══ [Pending Review · v3] ══ [Tạo lại] ──
⚠ 2 claim unsupported — không được duyệt (FR-GEN-06)

┌ Paper          ┬ Objective      ┬ Method ┬ Results ┐
│ RAG for NLP    │ Reduce halluc. │ Retr+G │ Effect. │
│ Survey Halluc. │ Survey         │ Not av │ Taxonomy│
└────────────────┴────────────────┴────────┴─────────┘
┌─ Draft (markdown preview) ─────────────────┐
│ RAG has been proposed as a method to…      │
└────────────────────────────────────────────┘
Claims (4):
  [supported/factual] RAG integrates retrieval…  → W10000001
  [partially_supported/interpretation] …        → W10000002
  [unsupported] …                               ← cảnh báo đỏ
```

---

## M3. Review & Export — `/review?session={id}`

**Mục đích:** Researcher + Reviewer kiểm tra claim/citation/evidence, phê duyệt, xuất DOCX.

```text
┌──────────────────────────────────────────────────────────────┐
│ Review & Export              (▾ Chọn session)                │
├──────────────────────────────────────────────┬───────────────┤
│ TRẠNG THÁI PHÊ DUYỆT                         │ CONFIRMED     │
│ [Pending Review · corpus v4]                 │ CORPUS (2)    │
│          [Approve ✓ #24]  [Export DOCX]      │ ├ W1 (abstract)│
│ ✓ Snapshot #24 · hash 3e1cdd5a… · v3         │ ├ W2 (abstract)│
│                                              │               │
│ Literature Review Draft                      │ LỊCH SỬ       │
│ ┌─ (markdown preview) ─────────────────────┐ │ EXPORT        │
│ │ RAG has been proposed as a method…       │ │ #18 file.docx │
│ └──────────────────────────────────────────┘ │ hash c499…    │
│                                              │ 17/11 20:30   │
│ Claims (4) — kiểm tra từng claim:            │               │
│ ┌ [supported/factual] ─────────────────────┐ │ QUY TẮC DUYỆT │
│ │ RAG integrates retrieval mechanisms…     │ │ (5 điều kiện  │
│ │ Nguồn: W10000001                         │ │  FR-APR-04)   │
│ └──────────────────────────────────────────┘ │               │
│ ┌ [partially_supported/interpretation] ────┐ │               │
│ │ …                                        │ │               │
│ └──────────────────────────────────────────┘ │               │
└──────────────────────────────────────────────┴───────────────┘
```

**Nút Approve / Export:**

| Trạng thái | Approve | Export DOCX |
|---|---|---|
| Draft thường, không unsupported | bật | tắt (chưa duyệt — FR-APR-04) |
| Còn claim unsupported | **tắt** + cảnh báo đỏ FR-APR-09 | tắt |
| Approved + snapshot Active | "Approved ✓ #id" | **bật** → tải file |
| Draft sửa sau duyệt | reset Pending Review (FR-APR-03) | tắt |
| Corpus đổi (stale) | phải rebuild + duyệt lại (FR-APR-04c) | tắt |

**Export thành công:** tải `.docx` + hiện Lịch sử Export (`export_id`, `file_name`, `export_file_hash`, thời gian).

---

## M4. Modal xác nhận hành động rủi ro (dùng chung)

Hiện trước: Accept/Override paper · Approve draft.

```text
┌── Xác nhận ────────────────────────────────┐
│ Hành động: Override paper                  │
│ Paper: RAG for Knowledge-Intensive NLP     │
│ AI classification: Partially Relevant      │  ← không đổi
│ Final: [Relevant ▾]                        │
│ Evidence: ❝ RAG combines… ❞               │
│ Corpus version: v3 → v4 (nếu membership đổi)│
│ ⚠ Cảnh báo stale (nếu có)                  │
│          [Cancel]  [Confirm]               │
└────────────────────────────────────────────┘
```

---

## M5. Trạng thái hệ thống (áp dụng mọi màn hình)

| Trạng thái | Hiển thị |
|---|---|
| **Processing** | `● ● ●` + tên tác vụ (searching/screening/…) — không cho tưởng treo |
| **Lỗi API/timeout** | loại lỗi + `[Retry]` `[Back]` — không hiện kết quả suy đoán |
| **Lỗi schema sau retry** | "Xử lý thất bại — thử lại" + giữ session id |
| **Thiếu evidence** | phạm vi corpus đã kiểm + `no_matching_evidence` |
| **Rỗng** | hướng dẫn từng bước theo ngữ cảnh (M1/M2/M3) |
| **Truncation** | "⚠ abstract đã rút gọn" khi vượt giới hạn LLM |

---

## Bản đồ màn hình → chức năng PRD

| Màn hình | PRD section | FR chính |
|---|---|---|
| M1 Dashboard | 11.2 Session, Search | FR-SES-01..04, FR-SRCH-* |
| M2 Research Chat | 11.2 Search→Generator | FR-SRCH, FR-SCRN, FR-SUMM, FR-RAG, FR-GEN |
| M3 Review & Export | 11.2 Approval/Export | FR-APR-01..09, FR-GEN-07..09 |
| M4 Modal | 5. HITL | mọi quyết định rủi ro |
| M5 Trạng thái | 6. Xử lý lỗi | retry, abstain, truncation |

# LitReview Agent — Guardrails thiết kế theo tầng (Gate 1)

> Trả lời yêu cầu của mentor: *"câu nào thuộc nhóm không được tự trả lời, chặn ở
> tầng nào, khi không chắc thì handover ra sao — Guardrail đủ các layer: input,
> action, output."*
>
> Tài liệu này audit hiện trạng + bổ sung phần còn thiếu. Mỗi guardrail ghi rõ:
> **tầng nào chặn, chặn cái gì, khi chặn thì làm gì**.

## 0. Bản đồ 4 tầng guardrail

```text
┌─ TẦNG 1: INPUT ────────────────────────────────────────────────┐
│ User query → chặn TRƯỚC khi chạm LLM                           │
│ • G1a  Injection/prompt-attack regex      (guardrails.py)  ✅  │
│ • G1b  Off-topic/domain scope             (guardrails.py)  🆕  │
│ • G1c  Session boundary (NFR-SEC-03/04)   (routes.py)       ✅  │
└────────────────────────────────────────────────────────────────┘
              ↓ (query hợp lệ)
┌─ TẦNG 2: ACTION (tool/HITL) ───────────────────────────────────┐
│ Agent muốn HÀNH ĐỘNG → chặn trước khi execute                  │
│ • G2a  Risky tool → HITL interrupt        (risky_tools.py) ✅  │
│ • G2b  Least-privilege tool registry      (TOOL_REGISTRY)  ✅  │
│ • G2c  Write-action guard (write ops)     (session_store)  🆕  │
└────────────────────────────────────────────────────────────────┘
              ↓ (action đã duyệt, dữ liệu lấy về)
┌─ TẦNG 3: OUTPUT (schema + nội dung) ───────────────────────────┐
│ LLM trả lời → chặn TRƯỚC khi trả user                          │
│ • G3a  Schema-first validation           (validate_output) ✅  │
│ • G3b  No-fabrication: không evidence    (service layer)  ✅  │
│        → không đủ căn cứ = KHÔNG tự trả lời                    │
│ • G3c  Leak check (system prompt/key)    (check_output_text) ✅ │
│ • G3d  Metadata ≠ bằng chứng M/D/R/F     (FR-SUMM-08)     ✅  │
└────────────────────────────────────────────────────────────────┘
              ↓
┌─ TẦNG 4: UNCERTAINTY → HANDOVER (khi không chắc) ──────────────┐
│ Không đủ căn cứ → KHÔNG tự kết luận, handover cho người        │
│ • G4a  Insufficient Evidence nhãn nghiệp vụ (FR-SCRN-05)  ✅   │
│ • G4b  RAG abstain: no/insufficient_evidence (FR-RAG-03)  ✅   │
│ • G4c  Summary not_mentioned — không điền (FR-SUMM-02)    ✅   │
│ • G4d  Unsupported claim chặn approval (FR-APR-09)        ✅   │
│ • G4e  HITL approve/reject cho hành động rủi ro (HITL-05) ✅   │
└────────────────────────────────────────────────────────────────┘
```

**Chú giải:** ✅ = đã có trong code · 🆕 = bổ sung trong PR này.

---

## 1. TẦNG INPUT — câu nào bị chặn trước khi tới LLM

### G1a. Prompt injection / tấn công đã biết ✅

**Tầng chặn:** `guardrail_check_node` (node đầu tiên của LangGraph, trước mọi
LLM call) → `guardrails.check_input()`.

| Payload bị chặn | Pattern |
|---|---|
| "ignore previous instructions" | `ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?...)` |
| "reveal your system prompt" | `(reveal|show|print|repeat)\s+...system...prompt` |
| "disregard your rules" | `disregard\s+(all\s+)?(previous|your)\s+(rules?)` |
| "you are now DAN/unrestricted" | `(from\s+now\s+on|you\s+are\s+now)...(DAN|unrestricted)` |
| "send/post/upload the system prompt/api key" | data-exfiltration qua tool |

**Khi chặn:** `GuardrailViolation` → state ghi `refusal_reason` → route thẳng
`finalize` (trả lời từ chối), **không gọi LLM, không chạy tool**.

### G1b. Off-topic / ngoài phạm vi sản phẩm 🆕 (bổ sung)

LitReview Agent KHÔNG tự trả lời các nhóm câu ngoài domain — chặn ở tầng input
regex trước LLM:

| Nhóm câu KHÔNG tự trả lời | Ví dụ bị chặn |
|---|---|
| Mã hoá/lừa đảo/hại | "viết code phishing", "cách làm bom" |
| Chẩn đoán y tế / pháp lý / tài chính cá nhân | "tôi bị đau bụng — bị bệnh gì?", "đầu tư vào đâu lãi?" |
| Viết bài academic TRỌN VẸN thay user | "viết giúp cả chương luận văn" (sản phẩm chỉ hỗ trợ review + draft có evidence) |
| Nội dung không liên quan literature review | "hôm nay thời tiết thế nào", "chế món ăn" |

**Khi chặn:** trả lời từ chối có lý do + hướng dẫn quay lại phạm vi sản phẩm
("LitReview Agent hỗ trợ tìm kiếm, sàng lọc, tóm tắt và tổng hợp tài liệu — hãy
đặt câu hỏi về nghiên cứu bạn đang review").

### G1c. Session boundary ✅

Mọi request API bắt buộc kèm `session_id` hợp lệ; mọi query DB theo cặp
`(session_id, paper_id)` — không dùng `paper_id` đơn lẻ (NFR-SEC-04, FR-CIT-01).
Citation tham chiếu chéo session bị từ chối. LLM chỉ nhận dữ liệu allowlist
của đúng session (NFR-SEC-03): Research Question, Metadata, Abstract, Summary,
Evidence Chunk, Draft context, User Question.

---

## 2. TẦNG ACTION — hành động rủi ro không tự chạy

### G2a. Risky tool → HITL handover ✅

Tool có tác dụng phụ ngoài hệ thống nằm trong `RISKY_TOOL_NAMES` (vd
`send_email`). Khi agent chọn tool này:

1. Graph route sang `human_review_node` — **KHÔNG execute ngay**
2. `interrupt()` dừng graph, trả payload `{question, tool, args}` cho client
3. UI hiện modal `[CẦN PHÊ DUYỆT]` + nút Approve/Reject
4. Người dùng `Command(resume="approve"|"reject")` → tool mới chạy / bị bỏ

**Đây chính là cơ chế handover khi không chắc:** agent không tự quyết hành
động có hệ quả — handover cho con người quyết định (PRD mục 5 HITL).

### G2b. Least-privilege tools ✅

Agent chỉ gọi được tool trong `TOOL_REGISTRY` (`search_knowledge`,
`calculate`). LLM bịa tên tool → `reason_node` raise ngay (không chạy).
Không có tool xóa dữ liệu / ghi ngoài hệ thống trong MVP.

### G2c. Write-action guard 🆕 (bổ sung)

Hành động GHI trong domain (khác read-only) đều có gate:

| Hành động ghi | Gate | Con người quyết |
|---|---|---|
| Đưa paper vào Confirmed Corpus | chỉ Accept/Override của user (FR-HITL-01) | ✅ người dùng |
| Sửa Summary | `PATCH` + `user_edited` flag, không ghi đè âm thầm (FR-SES-05) | ✅ người dùng |
| Approve draft | `POST /draft/approve` — chặn nếu claim unsupported (FR-APR-09) | ✅ người dùng |
| Export DOCX | 6 điều kiện FR-APR-04 — thiếu 1 là 422 | ✅ người dùng |
| Ghi đè giá trị user đã sửa | xác nhận hoặc giữ bản trước (FR-SES-05) | ✅ người dùng |

---

## 3. TẦNG OUTPUT — câu trả lời không được vượt bằng chứng

### G3a. Schema-first ✅

Mọi output LLM phải qua `guardrails.validate_output(raw, Schema, source)`:

| Node/Service | Schema | Sai schema thì sao |
|---|---|---|
| reason | `AgentDecision` | raise — không fallback |
| finalize | `FinalAnswer` | raise |
| Screening | `ScreeningResult` | retry 1 lần → `failed/timeout` (không gán nhãn giả) |
| Summary | `SummaryOutput` | retry 1 lần → `failed/timeout` |
| RAG | `RAGAnswer` | retry 1 lần → `failed` |
| Generator | `SynthesisDraft` | retry 1 lần → `failed` |

### G3b. No-fabrication — câu KHÔNG được tự trả lời ✅

Đây là nhóm câu cốt lõi yêu cầu của mentor — hệ thống **từ chối tự trả lời** khi
thiếu căn cứ, ở từng tính năng:

| Tính năng | Câu KHÔNG được tự trả lời | Hành vi khi chặn |
|---|---|---|
| Screening | "paper này liên quan" khi abstract không đủ | nhãn `Insufficient Evidence` — không đoán |
| Summary | điền Methodology/Dataset/Results khi abstract không nói | `Không đề cập trong nguồn hiện có` |
| Summary (metadata-only) | bất kỳ phát biểu M/D/R/F từ metadata | 4 trường not_mentioned, không gọi LLM |
| RAG | trả lời không có chunk hỗ trợ | `no_matching_evidence` + citations rỗng |
| RAG | kết luận vượt đoạn evidence | `insufficient_evidence` + nêu phần thiếu |
| Generator | claim không trỏ được về paper trong corpus | `support_status=unsupported` — **chặn approval** |
| Generator | research gap ngoài phạm vi corpus | chỉ diễn đạt "không paper nào trong corpus…" |
| References | trường metadata thiếu | "not available" — không tự điền |

### G3c. Leak check ✅

Output cuối chạy qua `check_output_text()`: chặn leak system prompt và API key
pattern `sk-…` trước khi trả user.

### G3d. Metadata ≠ bằng chứng ✅

Metadata (title/authors/year/venue/DOI) chỉ được dùng nhận diện + References;
**không được dùng làm căn cứ khẳng định Methodology/Dataset/Results/Findings**
(FR-RAG-10, FR-SUMM-08, FR-GEN-03). Evidence Chunk chỉ tạo từ abstract — không
từ metadata.

---

## 4. TẦNG UNCERTAINTY → HANDOVER (khi không chắc)

Câu trả lời chuẩn của hệ thống khi **không chắc** luôn là một trong 4 dạng
handover — không bao giờ là phỏng đoán:

| Dạng handover | Khi nào | Đến đâu |
|---|---|---|
| **Nhãn nghiệp vụ** `Insufficient Evidence` | AI chạy xong nhưng abstract thiếu căn cứ | → người dùng quyết: giữ/Reject/Override |
| **Trạng thái thực thi** `failed`/`timeout` + retry | lỗi kỹ thuật | → người dùng bấm Retry (không gán nhãn giả) |
| **Abstain có giải thích** `no/insufficient_evidence` | câu hỏi ngoài corpus / evidence không đủ | → nêu phạm vi corpus đã kiểm, gợi ý chỉnh câu hỏi |
| **HITL interrupt** `Approve/Reject` | hành động rủi ro (tool ngoài hệ thống, approve, export) | → người dùng quyết cuối |

Nguyên tắc xuyên suốt: **"không chắc" = handover ra ngoài, không phải tự đoán
rồi gắn nhãn tin cậy.** Cờ `uncertain`/`partially_supported` luôn hiển thị cho
người dùng, không được gói gọn trong câu trả lời tự tin.

---

## 5. Defence-in-depth: mỗi tầng có CẢ prompt LẪN code

| Tầng | Lớp prompt | Lớp code |
|---|---|---|
| Input | `prompts/safeguards.md` (KHÔNG bịa, KHÔNG tự xưng chuyên gia, uncertain bias) | `check_input()` regex + `safety_node` short-circuit |
| Action | system prompt: chỉ gọi tool trong registry | `TOOL_REGISTRY` + `RISKY_TOOL_NAMES` route HITL |
| Output | `prompts/citation_rules.md` (mọi claim phải citation) | `validate_output()` Pydantic + `check_output_text()` + schema từng service |
| Uncertainty | safeguards: "khi không rõ → uncertain" | nhãn nghiệp vụ + FR-APR-09 chặn approval |

---

## 6. Khoảng trống đã biết (công bằng — ghi nhận để sửa)

| Khoảng trống | Trạng thái | Kế hoạch |
|---|---|---|
| `safety_node.DANGER_KEYWORDS` còn là y tế (template cũ) — chưa cập nhật domain LitReview | 🆕 đã thêm nhóm off-topic/academic-abuse vào G1b trong PR này | nhóm duy trì list theo domain |
| Prompt injection regex chỉ chặn payload phổ biến — không chống được mọi biến thể | chấp nhận (defence-in-depth: schema + evidence contract phía sau) | eval injection trong eval/golden_dataset |
| Rate limit / auth chưa có (MVP single-user) | Out of scope theo PRD mục 10.2 | sau MVP |

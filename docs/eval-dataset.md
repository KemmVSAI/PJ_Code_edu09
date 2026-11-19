# Bộ dữ liệu kiểm thử (Evaluation Dataset) — đặc tính, nguồn, cách xây dựng

> Trả lời 3 câu hỏi của mentor về **bộ dữ liệu kiểm thử**: *lấy ở đâu · cách
> xây dựng như nào · đặc tính như nào.* Áp dụng cho PRD v1.1 mục 15 (Evaluation
> Metrics) — mỗi metric được ánh xạ tới dataset cụ thể, không chỉ target suông.

## 1. Hiện trạng — đã có gì, còn thiếu gì

### Đã có trong repo (`eval/`)

| Tài sản | Nội dung | Trạng thái |
|---|---|---|
| `eval/golden_dataset.yaml` | 10 case template (happy/ambiguous/safety/citation/injection) cho **agent chat** | ✅ dùng được — nhưng cho pipeline agent, KHÔNG phải metrics PRD |
| `eval/datasets/golden_sample.jsonl` | 10 case SAMPLE — ghi chú rõ *"đội thay bằng data thật ≥45 case"* | ⚠️ sample, chưa phải dataset thật |
| `eval/thresholds.yaml` | Ngưỡng PASS/FAIL: pass_rate ≥0.8, judge ≥4.0, safety zero-fail, cost ≤$0.50 | ✅ |
| `eval/run_eval.py` + `judge.py` + `cost_benchmark.py` | Runner + LLM-as-Judge + đo cost | ✅ |
| `eval/results/report.md` | Report tự sinh — **OFFLINE STUB**, chỉ chứng minh pipeline chạy | ⚠️ chưa phải kết quả thật |

### Khoảng trống — đúng như mentor nhận xét

PRD mục 15 đặt 7 metric target nhưng **chưa có file dataset nào cấp nguồn dữ liệu
cho 5 metric trong số đó**:

| Metric PRD | Dataset hiện có? | Khoảng trống |
|---|---|---|
| Screening Macro-F1 (≥0.80) | ❌ | Chưa có bộ paper + human reference label |
| Citation Traceability (100%) | ⚠️ đo trên output bất kỳ | Cần corpus chuẩn để biết "hợp lệ" là gì |
| Citation-Evidence Support (≥80%) | ❌ | Chưa có bộ claim + nhãn supported/partially |
| Summary Faithfulness (≥80%) | ❌ | Cần bộ summary + chấm so nguồn |
| Structured Output Validity (≥95%) | ✅ đo từ mọi LLM call | Không cần dataset riêng |
| End-to-End Task Completion (≥80%) | ❌ | Chưa có bộ kịch bản chốt |
| Time Reduction (Stretch) | ❌ | Cần bộ tác vụ + người tham gia |

---

## 2. Dataset lấy Ở ĐÂU — nguồn dữ liệu

| Dataset | Nguồn | Lý do chọn |
|---|---|---|
| **Corpus papers (50 bài)** | **OpenAlex API — tìm theo đúng Research Question của session eval** (vd query `retrieval-augmented generation hallucination`, sort `cited_by_count:desc`, lọc 2020–2025, lấy 50 bài đầu) | PRD mục 8: OpenAlex là nguồn duy nhất; API mở, metadata + abstract công khai, có DOI truy xuất được; mock API đã có sẵn cùng schema |
| **Human reference labels (screening)** | **2 thành viên nhóm gán nhãn** đọc abstract, chấm Relevant / Partially Relevant / Not Relevant / Insufficient Evidence; **adjudication** khi 2 người lệch (người thứ 3 hoặc thảo luận) | PRD mục 15.2: Human Reference Label do 2 annotator gán, không dùng `final_classification` |
| **Claim + support nhãn** | Sinh từ **output thật của Generator** trên corpus eval, rồi **2 người chấm** supported / partially_supported / unsupported theo rubric (Q-05) | Không thể tự tạo trước — claim là output AI; chấm sau khi chạy |
| **Summary faithfulness nhãn** | Sinh từ **output Summary thật**, chấm từng trường so với abstract nguồn | Vì sao nguồn | Như trên |
| **Kịch bản E2E** | Viết tay theo **happy path PRD mục 4** + nhánh lỗi (abstain, schema fail) — 5–8 kịch bản | Kịch bản là script, không phải dữ liệu API |
| **Agent golden cases (10+)** | Cập nhật `golden_dataset.yaml` hiện có — thay mock KB về domain LitReview | Template đã có khung category |

**Không dùng dữ liệu nào khác**: không scrap ngoài OpenAlex (PRD mục 10.2 Out
of Scope), không dùng paper có truy cập hạn chế, không dùng dữ liệu cá nhân.

---

## 3. Cách XÂY DỰNG — quy trình 5 bước (tổng công ~2 ngày)

### Bước 1 — Tạo corpus (nửa ngày)

```bash
# Script lấy 50 paper từ OpenAlex cho topic eval (Q-02), chuẩn hóa PaperOut:
python scripts/build_eval_corpus.py --query "retrieval augmented generation hallucination" --limit 50
# Xuất: eval/datasets/corpus_50.jsonl — mỗi dòng một paper đã chuẩn hóa
# (paper_id, title, authors, year, venue, doi, abstract, source_type)
```

Đặc tính kiểm tra khi build: ≥80% có abstract (để đủ dữ liệu Summary/RAG);
≥5 bài metadata_only (để test not_mentioned); DOI unique; không trùng OpenAlex ID.

### Bước 2 — Gán nhãn screening (1 ngày, 2 người)

```bash
python scripts/label_screening.py --dataset eval/datasets/corpus_50.jsonl
# In từng paper (title + abstract) → 2 annotator nhập nhãn riêng
# Xuất: eval/datasets/screening_labels.jsonl
# Mỗi dòng: paper_id, labeler1, labeler2, final_reference, adjudicated_by
```

Quy tắc: 2 người gán độc lập → so khớp → lệch thì adjudicate (thảo luận, ghi
quyết định + lý do). Tính **inter-annotator agreement** (Cohen's kappa) và ghi
vào report — kappa < 0.6 phải xem lại rubric.

### Bước 3 — Chạy hệ thống trên corpus (W4, khi Generator xong)

```bash
python scripts/run_eval_pipeline.py --corpus eval/datasets/corpus_50.jsonl
# Chạy: screen toàn bộ → summary từng paper → generate matrix + draft
# Xuất: eval/results/pipeline_outputs.jsonl — mọi output hệ thống sinh ra
```

### Bước 4 — Chấm các metric phụ thuộc output (nửa ngày, sau B3)

```bash
python scripts/label_claims.py   # chấm Citation-Evidence Support trên claims mẫu
python scripts/label_summary.py  # chấm Summary Faithfulness từng trường
```

### Bước 5 — Viết kịch bản E2E + chạy (W5)

```yaml
# eval/datasets/e2e_scenarios.yaml — 5–8 kịch bản chốt
scenarios:
  - id: e2e_happy
    steps: [create_session, search, add_papers, screen, review_accept,
            summary, rag_in_scope, generate, approve, export]
    expect: mỗi bước status đúng, DOCX sinh từ snapshot
  - id: e2e_no_evidence
    steps: [..., rag_out_of_scope]
    expect: no_matching_evidence + citations rỗng (không bịa)
  - id: e2e_reject_all
    steps: [..., review_reject_all, generate]
    expect: generate bị chặn (corpus rỗng) — thông báo đúng
```

---

## 4. ĐẶC TÍNH dataset phải đạt (tiêu chí chấp nhận)

| Đặc tính | Yêu cầu | Vì sao |
|---|---|---|
| **Kích thước** | 50 paper (một chủ đề, theo PRD mục 15.1) | đủ cho Macro-F1 có ý nghĩa ở 3 lớp; đúng giới hạn PRD |
| **Phân bố lớp screening** | mỗi lớp ≥ 8 paper (Relevant / Partially / Not Relevant) | lớp < 8 → Macro-F1 không đủ điều kiện tính (PRD 15.4) |
| **Có abstract** | ≥ 80% corpus có abstract; **giữ nguyên nhóm metadata_only ≥ 5 bài** | test cả nhánh not_mentioned (FR-SUMM-02) và nhánh metadata-only (FR-SUMM-08) |
| **Nhãn 2 annotators + adjudication** | mọi paper có `final_reference`; chênh lệch được ghi | Macro-F1 dùng nhãn adjudicated, không dùng final_classification (PRD 15.2) |
| **Chống leakage** | corpus eval KHÔNG dùng làm demo session trước khi chạy eval | tránh overfit — hệ thống phải xử lý "paper lạ" |
| **Version trong repo** | `eval/datasets/*.jsonl` commit vào git, ghi `built_at` + `source_query` | tái lập được kết quả (NFR-TEST-02) |
| **Không trùng** | OpenAlex ID + DOI chuẩn hóa unique trong corpus | FR-SRCH-04 |
| **Đa dạng độ dài abstract** | ≥ 5 bài abstract > 300 từ (test truncation + cảnh báo rút gọn) | FR về giới hạn LLM input (PRD 10.3) |
| **Kịch bản E2E có nhánh tiêu cực** | ≥ 2 kịch bản phảiFAIL (corpus rỗng, không evidence) | test abstain đúng, không chỉ happy path |
| **Cost đo được** | chạy 1 lượt eval ≤ $0.50 (thresholds.yaml) | phù hợp free-tier OpenRouter |

---

## 5. Ánh xạ Metric → Dataset → Cách đo (tổng hợp)

| Metric (PRD 15.3) | Dataset | Cách đo | Khi nào chạy |
|---|---|---|---|
| Screening Macro-F1 | `corpus_50.jsonl` + `screening_labels.jsonl` | So AI Prediction vs Human Reference trên 3 lớp; abstention + Technical Failure riêng | W2 xong, chạy lại W4 |
| Citation Traceability | Mọi output có citation (pipeline_outputs) | Auto-check citation_id → paper trong corpus | mỗi lần chạy |
| Citation-Evidence Support | Mẫu claims từ pipeline_outputs (phân tầng) | 2 người chấm rubric | sau W4 |
| Summary Faithfulness | Mẫu summary từ pipeline_outputs | Chấm từng trường so abstract | sau W3 |
| Structured Output Validity | Mọi LLM call trong eval | schema check tự động (first-attempt + final) | mỗi lần chạy |
| End-to-end Task Completion | `e2e_scenarios.yaml` | Pass/fail từng kịch bản | W5 |
| Time Reduction (Stretch) | Bộ tác vụ + user study nhỏ | So giờ với quy trình thủ công | W5 nếu còn thời gian |

---

## 6. Việc cần nhóm chốt (ghi vào Open Questions thực tế)

| Việc | Owner | Hạn theo PRD |
|---|---|---|
| Chốt **chủ đề eval** (Q-02) — quyết định query OpenAlex | QA | Cuối tuần 2 |
| Chốt **rubric chấm** Summary/Claim (Q-05) | QA | Nháp W3, chốt W4 |
| Phân công **2 annotators** (A-05) | Team | Trước khi gán nhãn |
| Xác nhận **nạp credit LLM** đủ chạy corpus 50 bài | Product | Trước Bước 3 |

> Các script `build_eval_corpus.py`, `label_screening.py`, `run_eval_pipeline.py`
> nêu ở bước 1–3 **chưa viết** — đây là kế hoạch xây dựng; viết theo thứ tự W2
> (corpus + labels) → W4 (pipeline outputs) → W5 (E2E scenarios).

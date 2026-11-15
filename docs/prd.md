# PRD — LitReview Agent

| Hạng mục | Nội dung |
|---|---|
| Mã dự án / đội | EDU-09 / P-107 |
| Phiên bản | 1.1 — Gate 1 |
| Trạng thái | MVP 5 tuần, đang chốt thiết kế |
| Brief liên quan | [`docs/brief.md`](brief.md) |

## 1. Bối cảnh & Mục tiêu

Literature review hiện phân tán giữa tìm kiếm học thuật, ghi chú, công cụ
citation và trình soạn thảo. LitReview Agent cung cấp một workflow thống nhất
để tìm kiếm, sàng lọc, tóm tắt, hỏi đáp có evidence và tạo bản nháp review.
Mục tiêu MVP là demo được workflow end-to-end với tối đa 50 bài/session,
nguồn OpenAlex, metadata/abstract và một citation style APA 7.

## 2. User personas

| Vai trò | Mô tả | Mục tiêu chính | Quyền hạn |
|---|---|---|---|
| Researcher | Sinh viên, học viên cao học hoặc nhà nghiên cứu | Tạo corpus và bản nháp có thể kiểm chứng | Tìm kiếm, review/override, hỏi đáp, chỉnh sửa, yêu cầu tạo draft và phê duyệt |
| Reviewer | Giảng viên hướng dẫn hoặc người kiểm tra | Đánh giá citation, evidence và nội dung trước khi xuất | Xem, bình luận/chỉnh sửa, yêu cầu sửa, phê duyệt hoặc từ chối export |

## 3. User stories

| ID | User story | Ưu tiên |
|---|---|---|
| US-01 | Là Researcher, tôi muốn nhập research question và tìm bài báo từ OpenAlex để tạo working set. | P0 |
| US-02 | Là Researcher, tôi muốn xem lý do AI phân loại và accept/reject/override từng bài để kiểm soát corpus. | P0 |
| US-03 | Là Researcher, tôi muốn tạo summary 5 trường và thấy provenance/thiếu dữ liệu để không nhầm AI đã đọc full text. | P0 |
| US-04 | Là Researcher, tôi muốn hỏi trên Confirmed Corpus và nhận citation/evidence hoặc thông báo chưa đủ căn cứ. | P0 |
| US-05 | Là Researcher, tôi muốn tạo comparison matrix và review draft có citation để chỉnh sửa. | P0 |
| US-06 | Là Reviewer, tôi muốn xem và phê duyệt draft hiện tại trước khi export DOCX. | P0 |
| US-07 | Là người dùng, tôi muốn thấy trạng thái loading, lỗi và dữ liệu rỗng để biết app đang làm gì. | P0 |
| US-08 | Là người dùng, tôi muốn bổ sung full-text PDF, nhiều nguồn tìm kiếm và citation style khác. | P2 — future |

## 4. Luồng chính (happy path)

1. Researcher mở app, tạo session và nhập research question.
2. Hệ thống tìm metadata/abstract từ OpenAlex; Researcher chọn bài vào working set.
3. Agent phân loại mức độ liên quan và hiển thị lý do/evidence.
4. Researcher accept, reject hoặc override; chỉ bài được xác nhận mới vào corpus.
5. Researcher yêu cầu summary, hỏi đáp hoặc tạo matrix/draft từ corpus.
6. Hệ thống hiển thị kết quả kèm citation và evidence; thiếu căn cứ thì abstain.
7. Researcher chỉnh sửa draft và gửi Reviewer kiểm tra.
8. Reviewer phê duyệt; hệ thống kiểm tra artifact không stale rồi mới cho export DOCX.

## 5. Human-in-the-loop

| Hành động rủi ro | Xác nhận | Thông tin phải thấy trước khi bấm |
|---|---|---|
| Đưa paper vào Confirmed Corpus | Researcher accept/override từng paper | Phân loại AI, lý do, abstract/metadata và lựa chọn cuối |
| Dùng kết quả AI trong draft | Researcher chỉnh sửa/ghi đè nội dung | Claim, citation, evidence, nguồn và trường thiếu dữ liệu |
| Phê duyệt draft | Researcher hoặc Reviewer bấm Approve | Phiên bản, corpus version, cảnh báo claim chưa valid/stale |
| Xuất DOCX | Chỉ cho phép sau approval hiện hành | Snapshot nội dung được duyệt, citation và hash export |

Không gửi mail, thanh toán hay xoá dữ liệu trong MVP. Guardrail phải nằm trong
API/domain validation, không chỉ trong prompt.

## 6. Xử lý lỗi & giới hạn

- Agent lỗi, timeout hoặc trả sai schema: retry có giới hạn; nếu vẫn lỗi, hiện
  trạng thái thất bại và cho phép thử lại, không lưu kết quả chưa hợp lệ.
- Không đủ evidence: trả `insufficient_evidence` hoặc `no_matching_evidence`,
  nêu rõ phạm vi corpus; không suy diễn và không tạo citation.
- Hết quota/API lỗi: hiện thông báo thân thiện, giữ dữ liệu/session và cho retry.
- Corpus/draft thay đổi: tăng `corpus_version`, đánh dấu draft/approval stale và
  chặn export cho đến khi tạo/kiểm tra lại.
- Abstract không có trường cần thiết: hiển thị “Không đề cập trong nguồn hiện có”.
- MVP không làm full-text PDF, thống kê, plagiarism check, cộng tác phức tạp,
  nhiều nguồn tìm kiếm hoặc cam kết chính xác tuyệt đối.

## 7. Dữ liệu

- Nguồn công khai duy nhất: OpenAlex API.
- Dữ liệu lưu: OpenAlex ID/DOI, title, authors, year, venue, abstract và source
  type (`metadata_only` hoặc `abstract`); evidence giữ nguyên đoạn nguồn.
- Dữ liệu mô phỏng được dùng cho test/eval; không dùng dữ liệu cá nhân hoặc tài
  liệu có quyền truy cập hạn chế.
- Session tối đa 50 paper; SQLite và chunk store trong database cho MVP.

## 8. Tech stack (dự kiến)

- Python 3.11, FastAPI/Uvicorn, Pydantic, SQLite.
- LangGraph/LangChain cho một workflow agent; OpenAI cho LLM.
- Frontend Next.js hoặc Streamlit (chưa chốt — xem mục 9).
- pytest + ruff; Docker + GitHub Actions; deploy backend trên nền tảng phù hợp.
- MVP không cần vector store: evidence chunk được lưu/truy xuất trong database.

## 9. Known Ambiguities

| Vấn đề chưa chốt | Cách chốt | Hạn chốt |
|---|---|---|
| Chọn Next.js hay Streamlit | Spike UX và thống nhất với người phụ trách frontend | Cuối tuần 1 |
| Nền tảng deploy cuối cùng | So sánh quota, HTTPS và thời gian cấu hình | Cuối tuần 2 |
| Cách reviewer truy cập session | Prototype permission/session sharing tối thiểu | Cuối tuần 2 |
| Bộ dữ liệu đánh giá screening | Gán nhãn mẫu công khai và thống nhất rubric | Cuối tuần 2 |
| Thành viên và ownership chi tiết | Cập nhật sau buổi phân công; sửa PRD cùng PR code liên quan | Trước bắt đầu tuần 1 |

Khi code đổi stack hoặc phạm vi, phải cập nhật mục này và PRD trong cùng PR;
code và test là source of truth kỹ thuật.


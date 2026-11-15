# Gate 1 — Chốt đề tài

**Đội:** P-107  
**Mã đề:** EDU-09  
**Sản phẩm:** LitReview Agent  
**Trạng thái:** Sẵn sàng tạo Pull Request để nộp Gate 1

## Minh chứng bắt buộc

| Deliverable | File |
|---|---|
| 1-page Brief | [`docs/brief.md`](brief.md) |
| PRD | [`docs/prd.md`](prd.md) |
| Wireframe / UI Flow | [`docs/ui-flow.md`](ui-flow.md) |
| Repo và AI Log setup | [README](../README.md), [PROJECT_CONTEXT](../PROJECT_CONTEXT.md) |

## Tóm tắt sản phẩm

LitReview Agent hỗ trợ người nghiên cứu tìm kiếm, sàng lọc, tóm tắt và tổng
hợp literature review từ metadata/abstract công khai. Mọi kết quả AI phải có
nguồn/evidence; người dùng hoặc reviewer giữ quyền chỉnh sửa, phê duyệt và
export DOCX.

## Checklist trước khi gửi PR

- [x] `docs/brief.md` có bài toán, ít nhất 2 vai trò, AI rationale, non-goals và metrics.
- [x] `docs/prd.md` có HITL, xử lý lỗi/giới hạn, Known Ambiguities, acceptance criteria và data/traceability rules.
- [x] `docs/ui-flow.md` có đủ các màn hình và UI Flow Mermaid.
- [x] Remote repo trỏ tới `AI20K-Build-Phase-Cohort-5/P-107`.
- [x] Branch `develop` tồn tại.
- [x] README có mô tả sản phẩm và quick start.
- [x] Virtual environment và dependencies đã cài.
- [x] AI logging pre-push hook đã cài.
- [ ] Điền API key thật vào `.env`; không commit file `.env`.
- [ ] Tạo log AI và xác nhận log đã gửi grading server.
- [ ] Push branch này và tạo PR `feature/gate1-deliverables` → `develop`.
- [ ] Có ít nhất một thành viên khác review và merge PR.
- [ ] Báo link PR/trang minh chứng trên channel Discord của đội.

## Kiểm tra gần nhất

- `pytest`: 55 tests passed khi chạy với `pytest-asyncio`.
- FastAPI `/health`: HTTP 200.
- Swagger `/docs`: HTTP 200.
- `docs/check_docs.py`: PASS.

## Lưu ý khi cập nhật

Khi đổi stack, phạm vi hoặc quyết định sản phẩm, cập nhật file liên quan trong
cùng Pull Request. PRD là context cho agent và phải được giữ khớp với code/test.


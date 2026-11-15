# LitReview Agent — Brief

**Mã đề:** EDU-09  **Đội:** P-107  **Ngày:** 15/11/2026

## Bài toán

Sinh viên, học viên cao học và nhà nghiên cứu thường phải chuyển qua lại giữa
công cụ tìm kiếm học thuật, bảng ghi chú, trình soạn thảo và công cụ citation
để làm literature review. Việc sàng lọc, đối chiếu và tổng hợp nhiều bài báo
tốn thời gian; đặc biệt khó kiểm tra một nhận định do AI tạo ra có thực sự nằm
trong nguồn hay không. Hiện tại họ tự làm các bước này thủ công và dễ bỏ sót
nguồn hoặc dùng citation không đủ căn cứ.

## Người dùng mục tiêu

| Vai trò | Nhu cầu | Đo bằng |
|---|---|---|
| Người nghiên cứu (sinh viên/học viên cao học) | Tìm, sàng lọc, tóm tắt và hỏi đáp trên tập bài báo có nguồn | Tỷ lệ hoàn thành workflow và thời gian kiểm tra đầu ra |
| Giảng viên hướng dẫn/reviewer | Xem, chỉnh sửa và phê duyệt bản nháp trước khi xuất | Tỷ lệ claim có citation/evidence hợp lệ và số lần phát hiện lỗi |

## Giải pháp

LitReview Agent gom quy trình literature review từ tìm kiếm đến xuất bản nháp
đã được duyệt vào một workflow có evidence và human-in-the-loop.

- Tìm bài báo và metadata/abstract từ OpenAlex.
- AI đề xuất phân loại liên quan; người nghiên cứu chấp nhận, loại hoặc ghi đè.
- Tạo tóm tắt có cấu trúc và hỏi đáp chỉ dựa trên evidence truy xuất được.
- Sinh comparison matrix và literature-review draft kèm citation.
- Reviewer/người nghiên cứu chỉnh sửa, phê duyệt rồi mới được xuất DOCX.

## Vì sao cần AI

LLM cần thiết cho các phần ngôn ngữ khó viết bằng luật cố định: giải thích mức
độ liên quan, tóm tắt abstract theo schema, trả lời câu hỏi theo nhiều evidence
và tổng hợp các nghiên cứu thành bản nháp. Phần tìm kiếm OpenAlex, lưu dữ liệu,
kiểm tra schema, kiểm tra citation/evidence, phân quyền, trạng thái phê duyệt
và chặn export là phần mềm thông thường; AI không được tự quyết định các hành
động rủi ro.

## Không làm (Non-goals)

- Không xử lý toàn văn PDF, bảng biểu, hình ảnh hoặc tài liệu bị giới hạn truy cập.
- Không tự động viết hoàn chỉnh luận văn/bài báo hoặc khẳng định research gap của toàn lĩnh vực.
- Không chạy thống kê, phân tích dữ liệu nghiên cứu hay kiểm tra đạo văn.
- Không tích hợp nhiều nguồn tìm kiếm ngoài OpenAlex trong MVP.
- Không cho export nếu người dùng chưa phê duyệt hoặc artifact đã stale.

## Đo thành công bằng gì

- ≥80% kịch bản MVP hoàn thành end-to-end từ tìm kiếm đến export sau phê duyệt.
- 100% citation truy xuất được đến paper hợp lệ trong Confirmed Corpus.
- ≥80% claim được người đánh giá xác nhận có evidence thực sự hỗ trợ.


# LitReview Agent

LitReview Agent là prototype web hỗ trợ quy trình literature review: từ tìm kiếm và sàng lọc paper, thu thập evidence, soạn thảo báo cáo, đến review claim và export tài liệu.

## Chạy dự án

```powershell
cd "F:\AI Thuc Chien\Build Phase\P-107\frontendvip"
pnpm install
pnpm dev
```

Mở `http://localhost:5173` trên trình duyệt.

Các lệnh thường dùng:

```powershell
pnpm typecheck  # Kiểm tra TypeScript
pnpm test       # Chạy unit tests
pnpm build      # Build production
pnpm start      # Chạy bản build production
```

## Các trang và chức năng

### Dashboard — `/`

- Tổng quan các research session.
- Thống kê số paper, tiến độ và trạng thái dự án.
- Danh sách recent projects.
- Tạo research session mới.

### Research Chat — `/research-chat`

Không gian nghiên cứu chính với các tab:

- **Assistant:** hỏi đáp theo chủ đề nghiên cứu.
- **Academic search:** tìm kiếm và lọc paper theo từ khóa, năm, tác giả và domain.
- **Smart screening:** quyết định include, exclude hoặc maybe cho paper.
- **Paper summaries:** xem tóm tắt và nhận định chính.
- **Evidence RAG:** hỏi đáp dựa trên evidence đã thu thập.
- **Comparison matrix:** so sánh các nghiên cứu theo nhiều trường dữ liệu.

Panel phụ hỗ trợ xem research tools, paper details và evidence passage.

### Draft Editor — `/draft-editor`

AI-powered Literature Review Draft Editor gồm:

- Document outline với 7 phần mặc định:
  1. Introduction
  2. Related Work
  3. Research Methodologies
  4. Comparison of Existing Studies
  5. Research Limitations
  6. Potential Research Gaps
  7. References
- Chỉnh sửa trực tiếp tiêu đề và nội dung document.
- Word count, số citation và trạng thái save.
- Chọn writing style: Academic, Concise, Critical.
- Chọn citation style: APA, IEEE, Harvard.
- Regenerate section và rewrite paragraph bằng evidence đã chọn.
- Evidence panel hiển thị paper, section và original excerpt.
- Highlight AI research gap suggestion.
- Cảnh báo unsupported claim cần bổ sung hoặc kiểm chứng.
- Save draft và gửi sang Review & Export.

### Review & Export — `/review-export`

Workspace review ba panel:

- **Panel trái:** sections, claims và review status.
- **Panel giữa:** document preview với claim, citation và reviewer comment.
- **Panel phải:** evidence inspector, citation metadata và reviewer actions.

Claim review hỗ trợ các trạng thái:

- Verified
- Needs Review
- Unsupported
- Rejected

Các thao tác reviewer:

- Approve
- Edit Claim
- Request Revision
- Reject
- Thêm comment cho claim.

Citation inspector hiển thị title, authors, year, DOI và source metadata. Evidence inspector hiển thị original excerpt, page/section, claim liên quan và verification status.

Review workflow hỗ trợ:

- **Researcher:** sửa draft, xử lý claim và submit for review.
- **Reviewer:** kiểm tra evidence, comment, approve hoặc request revision.
- Trạng thái document: Draft, Submitted for Review, Changes Requested, Approved.

DOCX export hỗ trợ APA, IEEE và Harvard. Nút export cuối chỉ được bật khi toàn bộ claim đã được xử lý.

## Mở rộng hoặc thu gọn sidebar

- Trên desktop, dùng nút sidebar ở góc trái header để ẩn hoặc mở lại navigation.
- Khi sidebar bị ẩn, nút mở lại vẫn còn trong header.
- Trên mobile, dùng nút menu để mở navigation dạng drawer.

## Cấu trúc thư mục chính

```text
client/
├── components/       # UI dùng chung, layout và research components
├── lib/               # Dữ liệu mẫu, research service và utilities
├── pages/             # Các trang của ứng dụng
├── App.tsx            # Routing chính
└── global.css         # Theme và global styles
server/                # Express server và API routes
shared/                # Types dùng chung giữa client và server
```

## Ghi chú

Đây là end-to-end clickable prototype. Dữ liệu paper, evidence, reviewer actions và export preview hiện được mô phỏng ở phía client để phục vụ demo UI/UX.

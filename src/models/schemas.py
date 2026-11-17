"""Pydantic schemas — schema-first anti-hallucination (good practice #4, team 012).

Vì sao tồn tại: output LLM không validate = không biết lúc nào agent bịa.
Mọi output quan trọng (quyết định reasoning, câu trả lời cuối) PHẢI đi qua
một Pydantic schema ở đây; sai schema → exception tường minh, không có
silent fallback.
"""

from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000, description="Tin nhắn từ user")
    session_id: str = Field(
        default_factory=lambda: uuid4().hex,
        description="Thread ID cho checkpointer (HITL multi-turn). Bỏ trống → mỗi request một thread mới",
    )


class ChatResponse(BaseModel):
    response: str = Field(..., description="Phản hồi từ agent")
    analysis: str = Field(default="", description="Phân tích nội bộ (tool trace tóm tắt)")
    session_id: str = Field(default="", description="Thread ID để gửi lại khi resume / chat tiếp")


class AgentDecision(BaseModel):
    """Output của node `reason` — LLM PHẢI trả đúng schema này.

    model_validator enforce nhất quán nội tại (action=tool thì phải có
    tool_name) — bắt lỗi schema ở chỗ sinh ra, không đợi chạy sai ở runtime.
    """

    thought: str = Field(..., min_length=1, description="Suy luận ngắn của agent ở vòng này")
    action: Literal["tool", "final"]
    tool_name: str | None = Field(default=None, description="Bắt buộc nếu action='tool'")
    tool_args: dict = Field(default_factory=dict, description="Tham số cho tool")
    enough_data: bool = Field(
        default=False,
        description="Self-assessment: đã đủ dữ kiện để trả lời chưa?",
    )
    final_answer: str | None = Field(default=None, description="Bắt buộc nếu action='final'")

    @model_validator(mode="after")
    def _check_consistency(self) -> "AgentDecision":
        if self.action == "tool" and not self.tool_name:
            raise ValueError("action='tool' đòi hỏi tool_name không rỗng")
        if self.action == "final":
            if self.tool_name:
                raise ValueError("action='final' không được kèm tool_name")
            if not self.final_answer or not self.final_answer.strip():
                raise ValueError("action='final' đòi hỏi final_answer không rỗng")
        return self


class FinalAnswer(BaseModel):
    """Output của node `finalize` / `finalize_with_partial`."""

    answer: str = Field(..., min_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)
    used_tools: list[str] = Field(default_factory=list)


class AgentAnswer(BaseModel):
    """Output có cấu trúc của agent (pattern retrieve→synthesize→validate — src/agents/nodes/).

    - `verdict` là Literal → LLM không thể bịa giá trị ngoài tập cho phép.
    - `confidence` bị kẹp trong [0, 1] → không có confidence 1.5 hay -0.3.
    - `citation_ids` ràng buộc: nếu verdict khác "uncertain" thì PHẢI có citation
      (check ở nodes/validate_node.py).
    """

    verdict: Literal["supported", "partially_supported", "unsupported", "uncertain"] = Field(
        description="Mức độ chắc chắn của câu trả lời so với ngữ cảnh"
    )
    confidence: float = Field(ge=0.0, le=1.0, description="Độ tin cậy, kẹp trong [0, 1]")
    answer: str = Field(min_length=1, max_length=2000, description="Câu trả lời cho user")
    citation_ids: list[str] = Field(default_factory=list, description="ID các chunk đã dùng, dạng ['chunk_1', ...]")

    # Quy tắc conservative: khoanh vùng "uncertain" thay vì bịa "supported" (inspire team 012).
    def is_safe(self) -> bool:
        if self.verdict != "uncertain" and not self.citation_ids:
            return False
        if self.verdict == "supported" and self.confidence < 0.6:
            return False
        return True


# ---------------------------------------------------------------------------
# Research Session & Academic Search — theo PRD v1.1 mục 11.2 (Search, Session)
# W1 scope: tạo session, search OpenAlex chuẩn hóa, thêm paper vào Working Set.
# ---------------------------------------------------------------------------

SessionCreateRequest = ChatRequest  # message = research question; tái dùng validate length


class SessionOut(BaseModel):
    session_id: str = Field(..., description="ID phiên nghiên cứu (thread_id cho agent)")
    research_question: str = Field(..., description="Câu hỏi nghiên cứu")
    corpus_version: int = Field(default=1, description="Chỉ tăng khi membership Confirmed Corpus đổi")
    created_at: str = Field(..., description="ISO timestamp")
    updated_at: str | None = Field(None, description="Lần cập nhật gần nhất")
    papers_count: int = Field(0, description="Số paper trong Working Set")
    corpus_count: int = Field(0, description="Số paper trong Confirmed Corpus")
    draft_status: str | None = Field(None, description="Trạng thái draft mới nhất nếu có")


class SearchRequest(BaseModel):
    session_id: str = Field(..., description="Session hiện tại")
    query: str = Field(..., min_length=1, max_length=300, description="Query tìm kiếm OpenAlex")
    max_results: int = Field(default=10, ge=1, le=50, description="Số kết quả tối đa (page size cố định)")


class PaperOut(BaseModel):
    """Paper metadata chuẩn hóa từ OpenAlex — FR-SRCH-01/02/06."""

    paper_id: str = Field(..., description="OpenAlex ID (W...)")
    session_id: str = Field("", description="Session sở hữu (rỗng = kết quả search chưa thêm)")
    title: str = Field(..., description="Tiêu đề paper")
    authors: list[str] = Field(default_factory=list, description="Danh sách tác giả")
    year: int | None = Field(default=None, description="Năm xuất bản")
    venue: str = Field("", description="Tạp chí/hội nghị")
    doi: str = Field("", description="DOI đã chuẩn hóa (rỗng nếu không có)")
    abstract: str = Field("", description="Abstract nguyên văn; rỗng nếu nguồn không có")
    source_type: Literal["metadata_only", "abstract"] = Field(
        ..., description="metadata_only = không có abstract; abstract = có abstract"
    )
    openalex_url: str = Field("", description="Link OpenAlex")


class SearchResponse(BaseModel):
    session_id: str
    query: str
    results: list[PaperOut]
    total_results: int = Field(0, description="Tổng số kết quả OpenAlex báo về")
    truncated: bool = Field(False, description="True nếu OpenAlex lỗi một phần / kết quả tải dở")
    error: str = Field("", description="Thông báo lỗi nếu OpenAlex không khả dụng (FR-SRCH-05)")


class AddPapersRequest(BaseModel):
    session_id: str = Field(...)
    paper_ids: list[str] = Field(..., min_length=1, description="Danh sách OpenAlex ID cần thêm")


class AddPapersResponse(BaseModel):
    session_id: str
    added: list[PaperOut] = Field(default_factory=list, description="Paper thêm mới thành công")
    skipped_duplicates: list[str] = Field(
        default_factory=list, description="ID bị chặn vì trùng OpenAlex ID/DOI trong session (FR-SRCH-04)"
    )
    working_set: list[PaperOut] = Field(default_factory=list, description="Working Set hiện tại của session")


# ---------------------------------------------------------------------------
# Smart Screening (W2) — PRD v1.1 mục 11.2: AI classification + user review.
# ---------------------------------------------------------------------------

ScreeningLabel = Literal["Relevant", "Partially Relevant", "Not Relevant", "Insufficient Evidence"]
ReviewStatus = Literal["Pending Review", "Accepted", "Rejected", "Overridden"]


class ScreeningEvidenceOut(BaseModel):
    source_type: Literal["metadata_only", "abstract"] = "abstract"
    source_reference: str = ""
    snippet: str = ""


class ScreeningItemOut(BaseModel):
    """Kết quả screening một paper — tách classification_status (thực thi) khỏi
    review_status (nghiệp vụ); lỗi kỹ thuật không có nhãn nghiệp vụ (FR-SCRN-08)."""

    paper_id: str
    title: str
    classification_status: Literal["pending", "processing", "completed", "failed", "timeout"]
    classification_error: str = ""
    ai_classification: ScreeningLabel | None = None
    reason: str = ""
    evidence: ScreeningEvidenceOut | None = None
    review_status: ReviewStatus = "Pending Review"
    final_classification: ScreeningLabel | None = None
    override_note: str = ""


class ScreenRequest(BaseModel):
    session_id: str = Field(..., description="Session hiện tại")
    paper_ids: list[str] = Field(
        default_factory=list,
        description="Bỏ trống → screen toàn bộ Working Set chưa có kết quả; batch tối đa 10/lần",
    )


class ScreenResponse(BaseModel):
    session_id: str
    results: list[ScreeningItemOut]
    summary: dict = Field(default_factory=dict, description="Đếm theo nhãn + số lỗi kỹ thuật")


class ReviewDecisionRequest(BaseModel):
    """Quyết định của người dùng — FR-SCRN-04: Accept / Reject / Override.

    Accept chỉ áp dụng cho Relevant/Partially Relevant/Not Relevant;
    Insufficient Evidence phải Reject hoặc Override (không Accept trực tiếp).
    """

    session_id: str
    paper_id: str
    decision: Literal["accept", "reject", "override"]
    final_classification: ScreeningLabel | None = Field(
        default=None, description="Bắt buộc khi decision=override; người dùng chọn trong 3 nhãn judged"
    )
    override_note: str = Field("", description="Lý do ghi đè, tùy chọn")


class ReviewDecisionResponse(BaseModel):
    session_id: str
    paper_id: str
    review_status: ReviewStatus
    final_classification: ScreeningLabel | None = None
    corpus_version: int
    in_corpus: bool = Field(..., description="Paper có thuộc Confirmed Corpus hiện hành không (FR-SCRN-07)")


# ---------------------------------------------------------------------------
# Paper Summarization (W3) — schemas
# ---------------------------------------------------------------------------

SummaryStatus = Literal["pending", "processing", "completed", "failed", "timeout"]


class SummaryFieldOut(BaseModel):
    value: str = ""
    not_mentioned: bool = True
    provenance: str = ""
    user_edited: bool = False


class SummaryRequest(BaseModel):
    session_id: str
    paper_id: str


class SummaryResponse(BaseModel):
    session_id: str
    paper_id: str
    summary_status: SummaryStatus
    fields: dict[str, SummaryFieldOut] = Field(default_factory=dict)
    source_type: str = ""
    user_edited: bool = False
    truncated: bool = False


class SummaryUpdateRequest(BaseModel):
    field_name: str = Field(..., description="Một trong 5 trường theo FR-SUMM-01")
    value: str = Field(..., min_length=1, max_length=5000)


# ---------------------------------------------------------------------------
# Evidence-based RAG (W4) — schemas
# ---------------------------------------------------------------------------

RAGAnswerStatus = Literal["sufficient_evidence", "insufficient_evidence", "no_matching_evidence", "failed"]


class RAGCitation(BaseModel):
    paper_id: str
    chunk_id: str
    snippet: str = Field(..., description="Trích nguyên văn từ abstract — evidence")
    source_type: str = "abstract"
    title: str = ""


class RAGRequest(BaseModel):
    session_id: str
    question: str = Field(..., min_length=1, max_length=2000)


class RAGResponse(BaseModel):
    session_id: str
    question: str
    answer_status: RAGAnswerStatus
    answer: str
    citations: list[RAGCitation] = Field(default_factory=list)
    corpus_version: int


# ---------------------------------------------------------------------------
# Literature Review Generator (W4) — schemas
# ---------------------------------------------------------------------------

GenerationStatus = Literal["completed", "failed", "timeout"]


class GenerateRequest(BaseModel):
    session_id: str


class GenerateResponse(BaseModel):
    session_id: str
    generation_status: GenerationStatus | None = None
    generation_error: str = ""
    draft_id: int | None = None
    content: str = ""
    matrix: list[dict] = Field(default_factory=list)
    claims: list[dict] = Field(default_factory=list)
    unsupported_count: int = 0
    status: str = "Pending Review"
    corpus_version: int = 1
    content_hash: str = ""


class DraftStatusRequest(BaseModel):
    draft_id: int
    status: Literal["Draft", "Pending Review", "Approved", "Stale"]

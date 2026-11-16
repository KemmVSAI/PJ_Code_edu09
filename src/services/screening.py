"""Smart Screening service — W2 theo PRD v1.1 mục 11.2 (Screening, Review).

Quy tắc bắt buộc (PRD):
- AI trả 1 trong 4 nhãn: Relevant / Partially Relevant / Not Relevant /
  Insufficient Evidence, kèm reason + evidence (source type + snippet nguyên văn).
- Tách classification_status (thực thi) khỏi review_status (nghiệp vụ):
  lỗi kỹ thuật KHÔNG biến thành nhãn nghiệp vụ.
- Output LLM validate theo schema; không hợp lệ retry 1 lần; vẫn lỗi →
  classification_status = failed/timeout, paper CHƯA có ai_classification.
- Dùng Research Question của session + metadata/abstract đã lưu;
  LLM classify model rẻ (cascade router).
"""

from __future__ import annotations

import logging
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from src.services.llm import get_llm
from src.services.session_store import PaperOut

logger = logging.getLogger("ai20k.screening")

ClassificationLabel = Literal["Relevant", "Partially Relevant", "Not Relevant", "Insufficient Evidence"]


class ScreeningEvidence(BaseModel):
    """Evidence truy xuất được của một phân loại — FR-SCRN-02."""

    source_type: Literal["metadata_only", "abstract"]
    source_reference: str = Field(..., description="Trường metadata hoặc đoạn abstract nguồn")
    snippet: str = Field("", description="Trích nguyên văn AI thực sự dùng, khi có")


class ScreeningResult(BaseModel):
    """Output LLM — validate theo schema trước khi lưu (FR-SCRN-09)."""

    ai_classification: ClassificationLabel
    reason: str = Field(..., min_length=1)
    evidence: ScreeningEvidence


_SCREENING_PROMPT = """Bạn là trợ lý sàng lọc tài liệu nghiên cứu. Đánh giá mức độ liên quan
giữa paper và câu hỏi nghiên cứu, CHỈ dựa trên dữ liệu đã cho — không suy diễn ngoài đó.

Research Question: {research_question}

Paper:
- Title: {title}
- Authors: {authors}
- Year: {year}
- Venue: {venue}
- Source type: {source_type}
- Abstract: {abstract}

Trả về DUY NHẤT một JSON object (không markdown, không giải thích) đúng schema:
{{
  "ai_classification": "Relevant" | "Partially Relevant" | "Not Relevant" | "Insufficient Evidence",
  "reason": "<lý do ngắn gọn, chỉ dựa trên dữ liệu trên>",
  "evidence": {{
    "source_type": "{source_type}",
    "source_reference": "<tên trường hoặc đoạn nguồn>",
    "snippet": "<trích NGUYÊN VĂN phần dữ liệu bạn dùng; nếu không có abstract thì snippet rỗng>"
  }}
}}

Quy tắc:
- "Insufficient Evidence" khi abstract/metadata không đủ để kết luận — KHÔNG được dùng khi chỉ là "không liên quan".
- "Not Relevant" chỉ khi dữ liệu đủ để khẳng định không liên quan.
- snippet phải chép nguyên văn, không viết lại.
"""


def _paper_payload(paper: PaperOut, research_question: str) -> str:
    return _SCREENING_PROMPT.format(
        research_question=research_question,
        title=paper.title,
        authors=", ".join(paper.authors[:5]) or "n/a",
        year=paper.year or "n/a",
        venue=paper.venue or "n/a",
        source_type=paper.source_type,
        abstract=(paper.abstract[:2000] if paper.abstract else "(không có abstract — chỉ có metadata)"),
    )


async def classify_paper(paper: PaperOut, research_question: str) -> dict:
    """Phân loại một paper. Trả dict với 2 trường bắt buộc theo PRD:

    - Thành công: {"classification_status": "completed", "ai_classification": ...,
      "reason", "evidence"}
    - Lỗi kỹ thuật sau 1 retry: {"classification_status": "failed"|"timeout",
      "classification_error": ...} — KHÔNG có nhãn nghiệp vụ giả.
    """
    llm = get_llm("classify")
    prompt = _paper_payload(paper, research_question)

    last_error = ""
    for attempt in range(2):  # FR-SCRN-09: retry tối đa 1 lần
        try:
            resp = await llm.ainvoke(prompt)
            content = resp.content if hasattr(resp, "content") else str(resp)
            # Tách JSON khỏi trường hợp LLM bọc markdown fence
            text = content.strip()
            if text.startswith("```"):
                text = text.split("```")[1].removeprefix("json").strip()
            result = ScreeningResult.model_validate_json(text)
            return {
                "classification_status": "completed",
                "ai_classification": result.ai_classification,
                "reason": result.reason,
                "evidence": result.evidence.model_dump(),
            }
        except ValidationError as exc:
            last_error = f"Schema validation failed (lần {attempt + 1}): {exc.error_count()} lỗi"
            logger.warning("screening %s: %s", paper.paper_id, last_error)
        except Exception as exc:  # noqa: BLE001 — LLM/network lỗi kỹ thuật
            last_error = f"LLM error (lần {attempt + 1}): {exc}"
            logger.warning("screening %s: %s", paper.paper_id, last_error)

    # Sau retry vẫn lỗi → trạng thái thực thi, không gán nhãn nghiệp vụ (FR-SCRN-08)
    status = "timeout" if "timeout" in last_error.lower() else "failed"
    return {"classification_status": status, "classification_error": last_error}


async def screen_papers(papers: list[PaperOut], research_question: str) -> list[dict]:
    """Phân loại batch — mặc định 10 paper/batch theo PRD mục 10.3."""
    results = []
    for paper in papers:
        result = await classify_paper(paper, research_question)
        results.append({"paper_id": paper.paper_id, "title": paper.title, **result})
    return results


def summarize_batch(results: list[dict]) -> dict:
    """Thống kê nhanh cho UI: đếm theo nhãn + số lỗi kỹ thuật (không trộn)."""
    labels: dict[str, int] = {}
    failures = 0
    for r in results:
        if r.get("classification_status") == "completed":
            label = r["ai_classification"]
            labels[label] = labels.get(label, 0) + 1
        else:
            failures += 1
    return {"labels": labels, "technical_failures": failures, "total": len(results)}

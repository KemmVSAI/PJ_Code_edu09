"""Paper Summarization service — W3 theo PRD v1.1 mục 11.2 (Summary).

Quy tắc bắt buộc (PRD):
- 5 trường: Research Objective, Methodology, Dataset, Results, Limitations.
- Mỗi trường chỉ điền từ nguồn hiện có; thiếu → "Không đề cập trong nguồn
  hiện có" (not_mentioned), KHÔNG suy diễn.
- Provenance theo từng trường: Paper ID + nguồn cụ thể.
- Metadata-only paper không được sinh phát biểu về methodology/dataset/findings
  (FR-SUMM-08): nếu chỉ có metadata, cả 4 trường nội dung研究 = not_mentioned.
- Schema validation + retry 1 lần; lỗi → summary_status failed/timeout.
- Abstract giới hạn 2.000 từ gửi LLM; abstract gốc giữ nguyên (chỉ truncate
  đầu vào, ghi truncated flag).
"""

from __future__ import annotations

import logging

from pydantic import BaseModel, Field, ValidationError

from src.services.llm import get_llm
from src.services.session_store import PaperOut

logger = logging.getLogger("ai20k.summary")

SUMMARY_FIELDS = ["Research Objective", "Methodology", "Dataset", "Results", "Limitations"]
NOT_MENTIONED = "Không đề cập trong nguồn hiện có"

# Giới hạn vận hành Summarization (PRD mục 10.3) — abstract gốc giữ nguyên
ABSTRACT_WORD_LIMIT = 2000


class SummaryField(BaseModel):
    value: str = Field(..., description="Nội dung trích từ nguồn, hoặc chuỗi not-mentioned")
    not_mentioned: bool = Field(..., description="True nếu nguồn không đề cập")
    provenance: str = Field(..., description="Nguồn cụ thể: 'abstract' hoặc tên trường metadata")


class SummaryOutput(BaseModel):
    """Schema LLM phải trả — validate trước khi lưu (PRD mục 11.2 Summary)."""

    research_objective: SummaryField
    methodology: SummaryField
    dataset: SummaryField
    results: SummaryField
    limitations: SummaryField


_SUMMARY_PROMPT = """Tóm tắt paper dưới đây theo đúng 5 trường. CHỈ dùng thông tin
có trong nguồn — không suy diễn, không bổ sung kiến thức ngoài.

Title: {title}
Authors: {authors}
Year: {year}
Venue: {venue}
Source type: {source_type}
Abstract:
{abstract}

Trả về DUY NHẤT JSON object (không markdown):
{{
  "research_objective": {{"value": "...", "not_mentioned": false, "provenance": "abstract"}},
  "methodology": {{"value": "...", "not_mentioned": false, "provenance": "abstract"}},
  "dataset": {{"value": "...", "not_mentioned": false, "provenance": "abstract"}},
  "results": {{"value": "...", "not_mentioned": false, "provenance": "abstract"}},
  "limitations": {{"value": "...", "not_mentioned": false, "provenance": "abstract"}}
}}

Quy tắc:
- Trường không có thông tin trong nguồn: value = "{not_mentioned}", not_mentioned = true,
  provenance vẫn ghi nguồn đã xem (vd "abstract").
- value chép/suy ra NGẮN GỌN từ câu chữ trong abstract; không diễn giải thêm.
- Với source_type = metadata_only (không abstract): 4 trường Methodology, Dataset,
  Results, Limitations PHẢI not_mentioned = true (metadata không đủ làm căn cứ).
"""


def _truncate_abstract(abstract: str) -> tuple[str, bool]:
    """Cắt abstract theo giới hạn từ — trả (text, truncated). Abstract gốc không đổi."""
    words = abstract.split()
    if len(words) <= ABSTRACT_WORD_LIMIT:
        return abstract, False
    return " ".join(words[:ABSTRACT_WORD_LIMIT]) + " …", True


def _empty_field(provenance: str = "metadata") -> dict:
    return {"value": NOT_MENTIONED, "not_mentioned": True, "provenance": provenance}


def metadata_only_summary(paper: PaperOut) -> dict:
    """Paper không có abstract — không suy diễn M/D/R/F từ metadata (FR-SUMM-08)."""
    fields = {
        "Research Objective": _empty_field("metadata"),
        "Methodology": _empty_field("metadata"),
        "Dataset": _empty_field("metadata"),
        "Results": _empty_field("metadata"),
        "Limitations": _empty_field("metadata"),
    }
    return {
        "summary_status": "completed",
        "fields": fields,
        "source_type": "metadata_only",
        "truncated": False,
    }


async def summarize_paper(paper: PaperOut) -> dict:
    """Tạo summary 5 trường. Trả dict có summary_status + fields + provenance.

    - completed: đủ 5 trường (kể cả not_mentioned).
    - failed/timeout: sau 1 retry vẫn lỗi — không có fields giả.
    """
    if paper.source_type == "metadata_only" or not paper.abstract.strip():
        return metadata_only_summary(paper)

    abstract_text, truncated = _truncate_abstract(paper.abstract)
    prompt = _SUMMARY_PROMPT.format(
        title=paper.title,
        authors=", ".join(paper.authors[:5]) or "n/a",
        year=paper.year or "n/a",
        venue=paper.venue or "n/a",
        source_type=paper.source_type,
        abstract=abstract_text,
        not_mentioned=NOT_MENTIONED,
    )

    llm = get_llm("generate")
    last_error = ""
    for attempt in range(2):
        try:
            resp = await llm.ainvoke(prompt)
            content = resp.content if hasattr(resp, "content") else str(resp)
            text = content.strip()
            if text.startswith("```"):
                text = text.split("```")[1].removeprefix("json").strip()
            out = SummaryOutput.model_validate_json(text)
            fields = {
                "Research Objective": out.research_objective.model_dump(),
                "Methodology": out.methodology.model_dump(),
                "Dataset": out.dataset.model_dump(),
                "Results": out.results.model_dump(),
                "Limitations": out.limitations.model_dump(),
            }
            # Ép đúng thông điệp not-mentioned — LLM đôi khi điền value khác
            for f in fields.values():
                if f["not_mentioned"]:
                    f["value"] = NOT_MENTIONED
            return {
                "summary_status": "completed",
                "fields": fields,
                "source_type": paper.source_type,
                "truncated": truncated,
            }
        except ValidationError as exc:
            last_error = f"Schema validation failed (lần {attempt + 1}): {exc.error_count()} lỗi"
            logger.warning("summary %s: %s", paper.paper_id, last_error)
        except Exception as exc:  # noqa: BLE001
            last_error = f"LLM error (lần {attempt + 1}): {exc}"
            logger.warning("summary %s: %s", paper.paper_id, last_error)

    status = "timeout" if "timeout" in last_error.lower() else "failed"
    return {"summary_status": status, "summary_error": last_error}

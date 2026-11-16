"""Literature Review Generator service — W4 theo PRD v1.1 mục 11.2 (Generator).

Quy tắc bắt buộc (PRD):
- Comparison Matrix: một dòng mỗi paper trong corpus, kể cả chưa có Summary;
  giá trị thiếu → "Not available"; không suy diễn (FR-GEN-01).
- Synthesis chỉ dùng Summary + Evidence Chunk của corpus hiện hành, trong
  phạm vi Research Question; không đủ evidence → ghi rõ giới hạn/abstain (FR-GEN-02).
- Generated Claim: factual/synthesis/interpretation; claim phải có citation +
  evidence; claim unsupported không được nằm trong nội dung duyệt (FR-GEN-03/06).
- Generator KHÔNG lấy input từ RAG Q&A, không phụ thuộc RAG history (FR-GEN-02).
"""

from __future__ import annotations

import logging
import re
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from src.services.llm import get_llm
from src.services.session_store import PaperOut

logger = logging.getLogger("ai20k.generator")

NOT_AVAILABLE = "Not available"


# ---------------------------------------------------------------------------
# Comparison Matrix — dựng trực tiếp từ Summary, không LLM (deterministic)
# ---------------------------------------------------------------------------


def build_matrix(papers: list[PaperOut], summaries: dict[str, dict]) -> list[dict]:
    """Một dòng mỗi paper trong corpus; thiếu → 'Not available' (FR-GEN-01).

    Summary lấy từ store nếu có; paper chưa có Summary → tất cả trường nội dung
    Not available (không gọi LLM lấp chỗ trống).
    """
    rows = []
    for paper in papers:
        summary = summaries.get(paper.paper_id)
        fields = summary.get("fields", {}) if summary else {}
        row = {
            "paper_id": paper.paper_id,
            "title": paper.title,
            "year": paper.year if paper.year else NOT_AVAILABLE,
            "venue": paper.venue or NOT_AVAILABLE,
            "source_type": paper.source_type,
        }
        for field in ("Research Objective", "Methodology", "Dataset", "Results", "Limitations"):
            f = fields.get(field)
            if f and not f.get("not_mentioned") and f.get("value"):
                row[field] = f["value"]
            else:
                row[field] = NOT_AVAILABLE
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------
# Synthesis Draft + Generated Claims
# ---------------------------------------------------------------------------


class GeneratedClaim(BaseModel):
    claim_text: str = Field(..., min_length=1)
    claim_type: Literal["factual", "synthesis", "interpretation"]
    citation_titles: list[str] = Field(default_factory=list, description="Title các paper hỗ trợ claim")
    evidence_snippets: list[str] = Field(default_factory=list, description="Snippet nguyên văn hỗ trợ")


class SynthesisDraft(BaseModel):
    title: str = Field("Literature Review Synthesis", description="Tiêu đề bản nháp")
    draft_markdown: str = Field(..., min_length=1, description="Nội dung synthesis dạng Markdown")
    claims: list[GeneratedClaim] = Field(default_factory=list)


_GEN_PROMPT = """Viết Literature Review Synthesis NGẮN (300–500 từ) về Research Question,
CHỈ dựa trên Summary và Evidence của các paper dưới đây.

Research Question: {research_question}

Dữ liệu từng paper:
{papers_block}

Yêu cầu:
- Mỗi câu mang thông tin (claim) phải kèm nguồn dạng [P1], [P2]... (chỉ số paper trong danh sách trên).
- KHÔNG dùng kiến thức ngoài; không có dữ kiện thì ghi rõ giới hạn, không suy diễn.
- Research gap chỉ nói trong phạm vi các paper trên ("không paper nào đề cập X").
- Trả về DUY NHẤT JSON:
{{
  "title": "Literature Review Synthesis",
  "draft_markdown": "…nội dung synthesis dùng [P1]-style citations…",
  "claims": [
    {{"claim_text": "…", "claim_type": "factual|synthesis|interpretation",
     "citation_titles": ["Title paper..."], "evidence_snippets": ["..."]}}
  ]
}}

Quy tắc claim:
- factual: một nguồn, trích thông tin cụ thể; synthesis: tổng hợp ≥2 nguồn; interpretation: nhận định
  của bạn DỰA trên evidence (phải có citation_titles).
- Mỗi claim phải có ít nhất một citation_titles trỏ đúng title paper trong danh sách.
- Không tạo claim không có căn cứ trong dữ liệu trên.
"""


def _papers_block(papers: list[PaperOut], summaries: dict[str, dict]) -> str:
    """Prompt compact: chỉ gửi trường CÓ nội dung (tiết kiệm prompt tokens —
    OpenRouter free-tier giới hạn cả input tokens theo credit)."""
    blocks = []
    for i, paper in enumerate(papers, start=1):
        summary = summaries.get(paper.paper_id)
        fields = summary.get("fields", {}) if summary else {}
        parts = [f"[P{i}] {paper.title[:80]} ({paper.year or 'n/a'}) {paper.source_type}"]
        for field in ("Research Objective", "Methodology", "Dataset", "Results", "Limitations"):
            f = fields.get(field)
            if f and not f.get("not_mentioned") and f.get("value"):
                parts.append(f"{field}: {f['value'][:200]}")
        blocks.append(" | ".join(parts))
    return "\n".join(blocks)


def _resolve_claim_citations(claims: list[GeneratedClaim], papers: list[PaperOut]) -> list[dict]:
    """Chuẩn hóa citation của claim về paper_id + chunk; claim không resolve được
    nguồn → support_status = unsupported (FR-GEN-03/06)."""
    by_lower_title = {p.title.strip().lower(): p for p in papers}
    by_index: dict[str, PaperOut] = {}
    for i, p in enumerate(papers, start=1):
        by_index[f"p{i}"] = p
    resolved = []
    for claim in claims:
        paper_ids: list[str] = []
        for cite in claim.citation_titles:
            paper = by_lower_title.get(cite.strip().lower())
            if paper is None:
                m = re.match(r"^p(\d+)$", cite.strip().lower())
                if m:
                    paper = by_index.get(f"p{m.group(1)}")
            if paper is not None:
                paper_ids.append(paper.paper_id)
        has_evidence = bool(claim.evidence_snippets) or bool(paper_ids)
        support = (
            "supported"
            if (paper_ids and claim.claim_type in ("factual", "synthesis"))
            else ("partially_supported" if claim.claim_type == "interpretation" and paper_ids else "unsupported")
        )
        if not has_evidence:
            support = "unsupported"
        resolved.append(
            {
                "claim_text": claim.claim_text,
                "claim_type": claim.claim_type,
                "paper_ids": paper_ids,
                "evidence_snippets": claim.evidence_snippets,
                "support_status": support,
            }
        )
    return resolved


async def generate_draft(
    research_question: str,
    papers: list[PaperOut],
    summaries: dict[str, dict],
) -> dict:
    """Tạo Synthesis Draft + claims từ Summary của corpus (FR-GEN-02/03).

    Trả: {draft_markdown, matrix, claims, generation_status}.
    Lỗi LLM sau retry → generation_status failed, không có draft giả.
    """
    matrix = build_matrix(papers, summaries)
    llm = get_llm("generate")
    prompt = _GEN_PROMPT.format(
        research_question=research_question,
        papers_block=_papers_block(papers, summaries),
    )

    last_error = ""
    for attempt in range(2):
        try:
            resp = await llm.ainvoke(prompt)
            content = resp.content if hasattr(resp, "content") else str(resp)
            text = content.strip()
            if text.startswith("```"):
                text = text.split("```")[1].removeprefix("json").strip()
            out = SynthesisDraft.model_validate_json(text)
            claims = _resolve_claim_citations(out.claims, papers)
            unsupported = [c for c in claims if c["support_status"] == "unsupported"]
            return {
                "generation_status": "completed",
                "draft_markdown": out.draft_markdown,
                "matrix": matrix,
                "claims": claims,
                "unsupported_count": len(unsupported),
            }
        except ValidationError as exc:
            last_error = f"Schema validation failed (lần {attempt + 1}): {exc.error_count()} lỗi"
            logger.warning("generate: %s", last_error)
        except Exception as exc:  # noqa: BLE001
            last_error = f"LLM error (lần {attempt + 1}): {exc}"
            logger.warning("generate: %s", last_error)

    return {
        "generation_status": "timeout" if "timeout" in last_error.lower() else "failed",
        "generation_error": last_error,
        "matrix": matrix,
        "claims": [],
        "unsupported_count": 0,
    }

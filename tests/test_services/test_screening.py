"""Test Smart Screening API (W2) — mock LLM theo screening contract.

Screening service gọi get_llm("classify") → monkeypatch ainvoke trả JSON
hợp lệ / không hợp lệ / lỗi để test đủ 3 nhánh: completed, schema-retry,
failed không gán nhãn giả. Quy tắc nghiệp vụ test theo PRD mục 11.2.
"""

import json

import pytest

from src.services import screening as screening_service
from src.services.session_store import PaperOut

PAPER = PaperOut(
    paper_id="W10000001",
    title="RAG reduces hallucination",
    authors=["Lewis"],
    year=2021,
    venue="NeurIPS",
    doi="10.1/x",
    abstract="RAG combines retrieval with generation.",
    source_type="abstract",
)

VALID_LABELS = ["Relevant", "Partially Relevant", "Not Relevant", "Insufficient Evidence"]


def _llm_response(label: str, snippet: str = "RAG combines retrieval") -> dict:
    return type(
        "R",
        (),
        {
            "content": json.dumps(
                {
                    "ai_classification": label,
                    "reason": "khớp chủ đề",
                    "evidence": {"source_type": "abstract", "source_reference": "abstract", "snippet": snippet},
                }
            )
        },
    )()


@pytest.mark.asyncio
async def test_classify_success_schema(monkeypatch):
    """Output hợp lệ → completed + đủ 4 trường."""

    class FakeLLM:
        async def ainvoke(self, prompt):
            return _llm_response("Relevant")

    monkeypatch.setattr(screening_service, "get_llm", lambda _t: FakeLLM())
    result = await screening_service.classify_paper(PAPER, "RQ")
    assert result["classification_status"] == "completed"
    assert result["ai_classification"] == "Relevant"
    assert result["evidence"]["snippet"].startswith("RAG combines")


@pytest.mark.asyncio
async def test_classify_invalid_schema_retried_then_failed(monkeypatch):
    """FR-SCRN-09: schema sai retry 1 lần; vẫn sai → failed, KHÔNG có nhãn giả."""

    class BadLLM:
        calls = 0

        async def ainvoke(self, prompt):
            BadLLM.calls += 1
            return type("R", (), {"content": "tôi nghĩ bài này hay lắm"})()

    monkeypatch.setattr(screening_service, "get_llm", lambda _t: BadLLM())
    result = await screening_service.classify_paper(PAPER, "RQ")
    assert BadLLM.calls == 2  # đúng 1 lần retry
    assert result["classification_status"] == "failed"
    assert "ai_classification" not in result or result.get("ai_classification") is None


@pytest.mark.asyncio
async def test_classify_technical_error_not_business_label(monkeypatch):
    """FR-SCRN-08: LLM lỗi kỹ thuật → failed/timeout, không phải Insufficient Evidence."""

    class BoomLLM:
        async def ainvoke(self, prompt):
            raise RuntimeError("connection refused")

    monkeypatch.setattr(screening_service, "get_llm", lambda _t: BoomLLM())
    result = await screening_service.classify_paper(PAPER, "RQ")
    assert result["classification_status"] in ("failed", "timeout")
    assert result.get("ai_classification") is None
    assert "classification_error" in result

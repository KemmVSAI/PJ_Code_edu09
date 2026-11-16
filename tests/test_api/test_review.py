"""Test review decision API (W2) — Accept/Reject/Override + corpus membership.

Mock-first: screening LLM monkeypatch ở tầng route (routes.screening_service).
Quy tắc theo PRD mục 11.2:
- Accept chỉ áp dụng cho 3 nhãn judged; Insufficient Evidence bị chặn (422).
- Override bắt buộc final_classification trong 3 nhãn judged.
- corpus_version chỉ tăng khi membership thay đổi (FR-SES-07).
- Confirmed Corpus chỉ gồm Accepted/Overridden + final Relevant/Partially.
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


def _llm_response(label: str) -> object:
    return type(
        "R",
        (),
        {
            "content": json.dumps(
                {
                    "ai_classification": label,
                    "reason": "khớp",
                    "evidence": {"source_type": "abstract", "source_reference": "abstract", "snippet": "RAG"},
                }
            )
        },
    )()


@pytest.fixture
async def screened_session(client, monkeypatch):
    """Session có 1 paper đã screening Relevant + 1 paper Insufficient Evidence."""

    class FakeLLM:
        def __init__(self):
            self.n = 0

        async def ainvoke(self, prompt):
            self.n += 1
            return _llm_response("Relevant" if self.n == 1 else "Insufficient Evidence")

    monkeypatch.setattr(screening_service, "get_llm", lambda _t: FakeLLM())
    session_id = (await client.post("/api/v1/sessions", json={"message": "RQ"})).json()["session_id"]
    await client.post("/api/v1/sessions/papers", json={"session_id": session_id, "paper_ids": ["W10000001"]})
    await client.post("/api/v1/screen", json={"session_id": session_id})
    return session_id


@pytest.mark.asyncio
async def test_accept_relevant_enters_corpus(client, screened_session):
    resp = await client.post(
        "/api/v1/screen/review",
        json={"session_id": screened_session, "paper_id": "W10000001", "decision": "accept"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["review_status"] == "Accepted"
    assert data["final_classification"] == "Relevant"
    assert data["in_corpus"] is True
    corpus = (await client.get(f"/api/v1/sessions/{screened_session}/corpus")).json()
    assert [p["paper_id"] for p in corpus] == ["W10000001"]


@pytest.mark.asyncio
async def test_accept_insufficient_evidence_blocked(client, screened_session):
    """FR-SCRN-05: không cho Accept trực tiếp Insufficient Evidence."""
    # Đặt nhãn IE cho W10000001 rồi thử Accept
    from src.services import session_store

    session_store.save_screening_result(
        screened_session,
        "W10000001",
        "completed",
        ai_classification="Insufficient Evidence",
        reason="thiếu dữ liệu",
        evidence={"source_type": "abstract", "source_reference": "abstract", "snippet": ""},
    )
    resp3 = await client.post(
        "/api/v1/screen/review",
        json={"session_id": screened_session, "paper_id": "W10000001", "decision": "accept"},
    )
    assert resp3.status_code == 422
    assert "FR-SCRN-05" in resp3.json()["detail"]


@pytest.mark.asyncio
async def test_override_into_corpus(client, screened_session):
    """FR-SCRN-07: Insufficient Evidence chỉ vào corpus qua Override thành Relevant."""
    from src.services import session_store

    session_store.save_screening_result(
        screened_session,
        "W10000001",
        "completed",
        ai_classification="Insufficient Evidence",
        reason="thiếu dữ liệu",
        evidence={"source_type": "abstract", "source_reference": "abstract", "snippet": ""},
    )
    resp = await client.post(
        "/api/v1/screen/review",
        json={
            "session_id": screened_session,
            "paper_id": "W10000001",
            "decision": "override",
            "final_classification": "Relevant",
            "override_note": "tôi đọc kỹ rồi",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["review_status"] == "Overridden"
    assert data["in_corpus"] is True
    # ai_classification không bị ghi đè
    screening = session_store.get_screening(screened_session, "W10000001")
    assert screening["ai_classification"] == "Insufficient Evidence"
    assert screening["final_classification"] == "Relevant"
    assert screening["override_note"] == "tôi đọc kỹ rồi"


@pytest.mark.asyncio
async def test_override_requires_valid_label(client, screened_session):
    resp = await client.post(
        "/api/v1/screen/review",
        json={
            "session_id": screened_session,
            "paper_id": "W10000001",
            "decision": "override",
            "final_classification": "Insufficient Evidence",  # không hợp lệ cho override
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_corpus_version_only_changes_on_membership_change(client, screened_session):
    """FR-SES-07: đổi quyết định nhưng membership không đổi → version không tăng."""
    # Accept Relevant → vào corpus → version tăng 1 lần
    r1 = (
        await client.post(
            "/api/v1/screen/review",
            json={"session_id": screened_session, "paper_id": "W10000001", "decision": "accept"},
        )
    ).json()
    assert r1["corpus_version"] == 2

    # Override Relevant → vẫn Relevant → trong corpus → membership KHÔNG đổi → version giữ
    r2 = (
        await client.post(
            "/api/v1/screen/review",
            json={
                "session_id": screened_session,
                "paper_id": "W10000001",
                "decision": "override",
                "final_classification": "Relevant",
            },
        )
    ).json()
    assert r2["corpus_version"] == 2  # không tăng

    # Reject → ra khỏi corpus → membership đổi → version tăng
    r3 = (
        await client.post(
            "/api/v1/screen/review",
            json={"session_id": screened_session, "paper_id": "W10000001", "decision": "reject"},
        )
    ).json()
    assert r3["corpus_version"] == 3
    assert r3["in_corpus"] is False

"""Test API W1 — session + search + working set (PRD v1.1 mục 12, AC-01/02).

Mock-first: OPENALEX_MOCK=1 trong conftest nên không gọi network thật.
"""

import pytest


@pytest.mark.asyncio
async def test_create_session(client):
    resp = await client.post("/api/v1/sessions", json={"message": "RAG giảm hallucination thế nào?"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"]
    assert data["research_question"] == "RAG giảm hallucination thế nào?"
    assert data["corpus_version"] == 1


@pytest.mark.asyncio
async def test_get_session_404(client):
    resp = await client.get("/api/v1/sessions/nonexistent")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_session_after_create(client):
    created = (await client.post("/api/v1/sessions", json={"message": "q"})).json()
    resp = await client.get(f"/api/v1/sessions/{created['session_id']}")
    assert resp.status_code == 200
    assert resp.json()["session_id"] == created["session_id"]


@pytest.mark.asyncio
async def test_search_returns_normalized_papers(client):
    session = (await client.post("/api/v1/sessions", json={"message": "q"})).json()["session_id"]
    resp = await client.post("/api/v1/search", json={"session_id": session, "query": "RAG hallucination"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["error"] == ""
    assert len(data["results"]) >= 1
    paper = data["results"][0]
    assert paper["paper_id"].startswith("W")
    assert paper["source_type"] in ("metadata_only", "abstract")
    assert paper["session_id"] == ""  # chưa thêm vào session


@pytest.mark.asyncio
async def test_search_invalid_session(client):
    resp = await client.post("/api/v1/search", json={"session_id": "nope", "query": "x"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_add_papers_dedupe(client):
    """AC-01.4/AC-02.1: paper trùng chỉ một entry trong session."""
    session = (await client.post("/api/v1/sessions", json={"message": "q"})).json()["session_id"]
    search = (await client.post("/api/v1/search", json={"session_id": session, "query": "RAG"})).json()
    ids = [p["paper_id"] for p in search["results"][:2]]

    first = (await client.post("/api/v1/sessions/papers", json={"session_id": session, "paper_ids": ids})).json()
    assert len(first["added"]) == 2
    assert first["skipped_duplicates"] == []

    second = (await client.post("/api/v1/sessions/papers", json={"session_id": session, "paper_ids": ids})).json()
    assert second["added"] == []
    assert sorted(second["skipped_duplicates"]) == sorted(ids)
    assert len(second["working_set"]) == 2


@pytest.mark.asyncio
async def test_working_set_isolated_per_session(client):
    """AC-02: paper gắn đúng session, không xuất hiện ở session khác."""
    s1 = (await client.post("/api/v1/sessions", json={"message": "q1"})).json()["session_id"]
    s2 = (await client.post("/api/v1/sessions", json={"message": "q2"})).json()["session_id"]
    ids = [
        p["paper_id"]
        for p in (await client.post("/api/v1/search", json={"session_id": s1, "query": "x"})).json()["results"][:1]
    ]

    await client.post("/api/v1/sessions/papers", json={"session_id": s1, "paper_ids": ids})
    ws1 = (await client.get(f"/api/v1/sessions/{s1}/papers")).json()
    ws2 = (await client.get(f"/api/v1/sessions/{s2}/papers")).json()
    assert len(ws1) == 1 and ws1[0]["session_id"] == s1
    assert ws2 == []

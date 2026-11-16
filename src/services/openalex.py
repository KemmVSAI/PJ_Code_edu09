"""OpenAlex connector — nguồn học thuật duy nhất của MVP (PRD v1.1 mục 8/11.2).

Chuẩn hóa PaperOut theo FR-SRCH-01/02/06:
- Trả title, authors, year, venue, DOI, OpenAlex ID, abstract.
- Không có abstract → source_type = metadata_only; có → abstract.
- Lỗi/timeout không bao giờ trả kết quả dở như hoàn chỉnh: raise → route
  chuyển thành SearchResponse.error với retry (FR-SRCH-05).

Mock-first: LIVEMOCK qua biến môi trường OPENALEX_MOCK=true dùng để test
UI/flow không cần network; default là gọi API thật (open, không cần key).
"""

from __future__ import annotations

import os
from typing import Any

import httpx

from src.models.schemas import PaperOut

_OPENALEX_BASE = "https://api.openalex.org/works"
_TIMEOUT_S = 15.0
_RECONSTRUCT_ABSTRACT = "abstract_inverted_index"


class OpenAlexError(Exception):
    """OpenAlex lỗi/timeout — route chuyển thành error + retry, không trả kết quả dở."""


def _reconstruct_abstract(inverted: dict[str, list[int]] | None) -> str:
    """OpenAlex lưu abstract dạng inverted index → dựng lại text nguyên văn."""
    if not inverted:
        return ""
    positions: dict[int, str] = {}
    for word, idxs in inverted.items():
        for i in idxs:
            positions[i] = word
    return " ".join(positions[i] for i in sorted(positions))


def _normalize_work(work: dict[str, Any]) -> PaperOut:
    """work JSON của OpenAlex → PaperOut chuẩn hóa (mock-safe, thiếu trường không crash)."""
    abstract = _reconstruct_abstract(work.get(_RECONSTRUCT_ABSTRACT)) or str(work.get("abstract") or "")
    venue = ""
    primary = work.get("primary_location") or {}
    source = primary.get("source") or {}
    venue = str(source.get("display_name") or "")
    doi_raw = str(work.get("doi") or "")
    doi = doi_raw.removeprefix("https://doi.org/") if doi_raw else ""
    authors = [
        str(a.get("author", {}).get("display_name") or "")
        for a in (work.get("authorships") or [])
        if a.get("author", {}).get("display_name")
    ]
    return PaperOut(
        paper_id=str(work.get("id") or "").removeprefix("https://openalex.org/"),
        session_id="",  # chưa thuộc session cho tới khi người dùng thêm vào
        title=str(work.get("display_name") or "(không có tiêu đề)"),
        authors=authors,
        year=work.get("publication_year"),
        venue=venue,
        doi=doi,
        abstract=abstract,
        source_type="abstract" if abstract else "metadata_only",
        openalex_url=str(work.get("id") or ""),
    )


async def search(query: str, max_results: int = 10) -> tuple[list[PaperOut], int]:
    """Gọi OpenAlex /works?search=... — trả (papers, total_count).

    Raises OpenAlexError khi HTTP lỗi/timeout/network — caller (route) bắt
    và trả error + retry theo FR-SRCH-05.
    """
    if os.getenv("OPENALEX_MOCK", "").lower() in ("1", "true", "yes"):
        return _mock_search(query, max_results)

    params: dict[str, str | int] = {
        "search": query,
        "per-page": min(max_results, 50),
        "mailto": "litreview-agent@example.com",  # polite pool của OpenAlex
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            resp = await client.get(_OPENALEX_BASE, params=params)
            resp.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        raise OpenAlexError(f"OpenAlex không khả dụng: {exc}") from exc

    data = resp.json()
    papers = [_normalize_work(w) for w in data.get("results", [])]
    return papers, int(data.get("meta", {}).get("count", len(papers)))


async def get_by_id(paper_id: str) -> PaperOut:
    """Fetch một work theo OpenAlex ID (route /works/{id}).

    Raises OpenAlexError cho lỗi network; trả PaperOut hay None theo kết quả.
    """
    if os.getenv("OPENALEX_MOCK", "").lower() in ("1", "true", "yes"):
        for work in _MOCK_WORKS:
            if work["id"].removeprefix("https://openalex.org/") == paper_id:
                return _normalize_work(work)
        return None

    url = f"https://api.openalex.org/works/{paper_id}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            resp = await client.get(url, params={"mailto": "litreview-agent@example.com"})
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
    except (httpx.HTTPError, httpx.TimeoutException) as exc:
        raise OpenAlexError(f"OpenAlex không khả dụng: {exc}") from exc
    return _normalize_work(resp.json())


_MOCK_WORKS = [
    {
        "id": "https://openalex.org/W10000001",
        "display_name": "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
        "publication_year": 2021,
        "doi": "https://doi.org/10.1234/rag-2021",
        "primary_location": {"source": {"display_name": "NeurIPS"}},
        "authorships": [{"author": {"display_name": "Patrick Lewis"}}, {"author": {"display_name": "Jane Doe"}}],
        "abstract_inverted_index": {
            "Retrieval-augmented": [0],
            "generation": [1],
            "combines": [2],
            "retrieval": [3],
            "with": [4],
            "synthesis": [5],
            "to": [6],
            "reduce": [7],
            "hallucination": [8],
        },
    },
    {
        "id": "https://openalex.org/W10000002",
        "display_name": "A Survey of Hallucination in Large Language Models",
        "publication_year": 2023,
        "doi": "https://doi.org/10.1234/hallu-2023",
        "primary_location": {"source": {"display_name": "ACM Computing Surveys"}},
        "authorships": [{"author": {"display_name": "Lei Huang"}}],
        "abstract_inverted_index": {
            "We": [0],
            "survey": [1],
            "hallucination": [2],
            "phenomena": [3],
            "in": [4],
            "large": [5],
            "language": [6],
            "models": [7],
            "and": [8],
            "propose": [9],
            "mitigation": [10],
            "taxonomy": [11],
        },
    },
    {
        "id": "https://openalex.org/W10000003",
        "display_name": "Systematic Literature Review Methodology",
        "publication_year": 2022,
        "doi": "",
        "primary_location": {"source": {"display_name": "Journal of Systems"}},
        "authorships": [{"author": {"display_name": "Barbara Kitchenham"}}],
        "abstract_inverted_index": None,  # không có abstract → metadata_only
    },
]


def _mock_search(query: str, max_results: int) -> tuple[list[PaperOut], int]:
    """Mock data cho UI/flow test — đủ 3 dạng: có abstract, thiếu abstract, thiếu DOI."""
    papers = [_normalize_work(w) for w in _MOCK_WORKS][:max_results]
    return papers, len(papers)

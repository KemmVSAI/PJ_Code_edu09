"""Session store — SQLite persistence cho Research Session và Working Set.

Vì sao tồn tại: PRD v1.1 mục 11.2 (Session) yêu cầu session restore sau
restart và paper trùng ID/DOI chỉ một entry trong session. Đây là điểm
duy nhất chạm database cho W1; các entity sau (screening, summary, draft)
sẽ thêm bảng ở đây thay vì file riêng.

Schema tối thiểu theo PRD:
- Research Session: session_id, research_question, corpus_version, created_at
- Paper: paper_id (OpenAlex ID), session_id, title, authors, year, venue,
  doi, abstract, source_type (metadata_only/abstract)

Ràng buộc session isolation: mọi thao tác query theo (session_id, paper_id),
không dùng paper_id đơn lẻ. Dedupe theo OpenAlex ID hoặc DOI chuẩn hóa.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import UTC, datetime
from pathlib import Path

from src.config import get_settings
from src.models.schemas import PaperOut

_SCHEMA = """
CREATE TABLE IF NOT EXISTS research_session (
    session_id TEXT PRIMARY KEY,
    research_question TEXT NOT NULL,
    corpus_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paper (
    paper_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    title TEXT NOT NULL,
    authors_json TEXT NOT NULL DEFAULT '[]',
    year INTEGER,
    venue TEXT NOT NULL DEFAULT '',
    doi TEXT NOT NULL DEFAULT '',
    abstract TEXT NOT NULL DEFAULT '',
    source_type TEXT NOT NULL CHECK (source_type IN ('metadata_only', 'abstract')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (paper_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_paper_session_doi ON paper (session_id, doi);
"""

_LOCAL = threading.local()


def _db_file() -> Path:
    """Trích file SQLite từ DATABASE_URL.

    PRD W1 dùng SQLite; nếu URL là postgres (template .env mặc định) thì
    fallback về ./data/app.db thay vì crash với OSError trên Windows —
    session store là tầng SQLite duy nhất của MVP, postgres chỉ xem xét
    sau MVP (PRD mục 8).
    """
    url = get_settings().database_url
    if url.startswith("sqlite:///"):
        return Path(url.removeprefix("sqlite:///./").removeprefix("sqlite:///"))
    return Path("./data/app.db")


def _conn() -> sqlite3.Connection:
    """Connection per-thread (uvicorn async worker) — SQLite ghi tuần tự an toàn."""
    if getattr(_LOCAL, "conn", None) is None:
        db_path = _db_file()
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        _LOCAL.conn = sqlite3.connect(db_path)
        _LOCAL.conn.row_factory = sqlite3.Row
        _LOCAL.conn.executescript(_SCHEMA)
        _LOCAL.conn.commit()
    return _LOCAL.conn


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _normalize_doi(doi: str) -> str:
    """Chuẩn hóa DOI: lowercase, bỏ prefix https://doi.org/ — FR-SRCH-04."""
    doi = doi.strip().lower()
    for prefix in ("https://doi.org/", "http://doi.org/", "doi.org/"):
        if doi.startswith(prefix):
            doi = doi[len(prefix) :]
    return doi


def create_session(research_question: str, session_id: str) -> dict:
    conn = _conn()
    now = _now()
    conn.execute(
        "INSERT INTO research_session (session_id, research_question, corpus_version, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?)",
        (session_id, research_question, now, now),
    )
    conn.commit()
    return {
        "session_id": session_id,
        "research_question": research_question,
        "corpus_version": 1,
        "created_at": now,
    }


def get_session(session_id: str) -> dict | None:
    row = (
        _conn()
        .execute(
            "SELECT session_id, research_question, corpus_version, created_at FROM research_session WHERE session_id = ?",
            (session_id,),
        )
        .fetchone()
    )
    if row is None:
        return None
    return {
        "session_id": row["session_id"],
        "research_question": row["research_question"],
        "corpus_version": row["corpus_version"],
        "created_at": row["created_at"],
    }


def list_sessions(limit: int = 20) -> list[dict]:
    rows = (
        _conn()
        .execute(
            "SELECT session_id, research_question, corpus_version, created_at "
            "FROM research_session ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )
        .fetchall()
    )
    return [
        {
            "session_id": r["session_id"],
            "research_question": r["research_question"],
            "corpus_version": r["corpus_version"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


def _row_to_paper(row: sqlite3.Row) -> PaperOut:
    return PaperOut(
        paper_id=row["paper_id"],
        session_id=row["session_id"],
        title=row["title"],
        authors=json.loads(row["authors_json"]),
        year=row["year"],
        venue=row["venue"],
        doi=row["doi"],
        abstract=row["abstract"],
        source_type=row["source_type"],
    )


def upsert_papers(session_id: str, papers: list[PaperOut]) -> tuple[list[PaperOut], list[str]]:
    """Thêm paper vào Working Set; trả (added, skipped_duplicates).

    Dedupe theo paper_id (OpenAlex ID) hoặc DOI đã chuẩn hóa trong cùng
    session — FR-SRCH-04. Không ghi đè paper đã có (FR-SES-05 tinh thần).
    """
    conn = _conn()
    existing_ids = {
        r["paper_id"] for r in conn.execute("SELECT paper_id FROM paper WHERE session_id = ?", (session_id,)).fetchall()
    }
    existing_dois = {
        r["doi"]
        for r in conn.execute("SELECT doi FROM paper WHERE session_id = ? AND doi != ''", (session_id,)).fetchall()
    }

    added: list[PaperOut] = []
    skipped: list[str] = []
    now = _now()
    for paper in papers:
        if paper.paper_id in existing_ids or (paper.doi and _normalize_doi(paper.doi) in existing_dois):
            skipped.append(paper.paper_id)
            continue
        conn.execute(
            "INSERT INTO paper (paper_id, session_id, title, authors_json, year, venue, doi, abstract, source_type, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                paper.paper_id,
                session_id,
                paper.title,
                json.dumps(paper.authors, ensure_ascii=False),
                paper.year,
                paper.venue,
                _normalize_doi(paper.doi),
                paper.abstract,
                paper.source_type,
                now,
            ),
        )
        existing_ids.add(paper.paper_id)
        if paper.doi:
            existing_dois.add(_normalize_doi(paper.doi))
        added.append(paper)
    conn.commit()
    return added, skipped


def get_working_set(session_id: str) -> list[PaperOut]:
    rows = (
        _conn()
        .execute(
            "SELECT * FROM paper WHERE session_id = ? ORDER BY created_at DESC, paper_id",
            (session_id,),
        )
        .fetchall()
    )
    return [_row_to_paper(r) for r in rows]


def get_paper(session_id: str, paper_id: str) -> PaperOut | None:
    """Truy vấn theo cặp (session_id, paper_id) — session isolation (PRD mục Session)."""
    row = (
        _conn()
        .execute(
            "SELECT * FROM paper WHERE session_id = ? AND paper_id = ?",
            (session_id, paper_id),
        )
        .fetchone()
    )
    return _row_to_paper(row) if row else None

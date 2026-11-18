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

CREATE TABLE IF NOT EXISTS paper_summary (
    summary_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    summary_status TEXT NOT NULL CHECK (summary_status IN
        ('pending', 'processing', 'completed', 'failed', 'timeout')),
    fields_json TEXT NOT NULL DEFAULT '{}',
    source_type TEXT NOT NULL DEFAULT '',
    user_edited INTEGER NOT NULL DEFAULT 0,
    truncated INTEGER NOT NULL DEFAULT 0,
    generated_at TEXT NOT NULL,
    FOREIGN KEY (session_id, paper_id) REFERENCES paper (session_id, paper_id),
    UNIQUE (session_id, paper_id)
);

CREATE TABLE IF NOT EXISTS review_draft (
    draft_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    content TEXT NOT NULL,
    matrix_json TEXT NOT NULL DEFAULT '[]',
    claims_json TEXT NOT NULL DEFAULT '[]',
    unsupported_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Pending Review' CHECK (status IN
        ('Draft', 'Pending Review', 'Approved', 'Stale')),
    corpus_version INTEGER NOT NULL,
    content_hash TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approval_snapshot (
    approval_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    draft_id INTEGER NOT NULL,
    approved_version INTEGER NOT NULL DEFAULT 1,
    approved_content_snapshot TEXT NOT NULL,
    approved_content_hash TEXT NOT NULL,
    approved_corpus_version INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Invalidated')),
    approved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS export_record (
    export_id INTEGER PRIMARY KEY AUTOINCREMENT,
    approval_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    export_file_hash TEXT NOT NULL,
    exported_at TEXT NOT NULL,
    FOREIGN KEY (approval_id) REFERENCES approval_snapshot (approval_id)
);

CREATE TABLE IF NOT EXISTS rag_exchange (
    exchange_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    answer_status TEXT NOT NULL CHECK (answer_status IN
        ('sufficient_evidence', 'insufficient_evidence', 'no_matching_evidence', 'failed')),
    citations_json TEXT NOT NULL DEFAULT '[]',
    corpus_version INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS screening_result (
    screening_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    paper_id TEXT NOT NULL,
    classification_status TEXT NOT NULL CHECK (classification_status IN
        ('pending', 'processing', 'completed', 'failed', 'timeout')),
    classification_error TEXT NOT NULL DEFAULT '',
    ai_classification TEXT CHECK (ai_classification IN
        ('Relevant', 'Partially Relevant', 'Not Relevant', 'Insufficient Evidence')),
    reason TEXT NOT NULL DEFAULT '',
    evidence_json TEXT NOT NULL DEFAULT '{}',
    review_status TEXT NOT NULL DEFAULT 'Pending Review' CHECK (review_status IN
        ('Pending Review', 'Accepted', 'Rejected', 'Overridden')),
    final_classification TEXT,
    override_note TEXT NOT NULL DEFAULT '',
    classified_at TEXT,
    reviewed_at TEXT,
    FOREIGN KEY (session_id, paper_id) REFERENCES paper (session_id, paper_id),
    UNIQUE (session_id, paper_id)
);
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
    """Connection per-thread (uvicorn async worker) — SQLite ghi tuần tự an toàn.

    Phoenix-mentor review (PR #6): async context nhiều task dùng chung thread
    có thể gây 'database is locked' khi ghi đồng thời. Mitigation:
    - busy_timeout 30s: writer chờ writer thay vì lỗi ngay.
    - journal_mode=WAL: đọc không chặn ghi, phù hợp FastAPI threadpool.
    """
    if getattr(_LOCAL, "conn", None) is None:
        db_path = _db_file()
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        _LOCAL.conn = sqlite3.connect(db_path, timeout=30.0)
        _LOCAL.conn.row_factory = sqlite3.Row
        _LOCAL.conn.execute("PRAGMA busy_timeout = 30000")
        _LOCAL.conn.execute("PRAGMA journal_mode = WAL")
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
        "updated_at": now,
        "papers_count": 0,
        "corpus_count": 0,
        "draft_status": None,
    }


def get_session(session_id: str) -> dict | None:
    row = (
        _conn()
        .execute(
            "SELECT session_id, research_question, corpus_version, created_at, updated_at FROM research_session WHERE session_id = ?",
            (session_id,),
        )
        .fetchone()
    )
    if row is None:
        return None
    sid = row["session_id"]
    papers = _conn().execute(
        "SELECT COUNT(*) FROM paper WHERE session_id = ?", (sid,)
    ).fetchone()[0]
    in_corpus = _conn().execute(
        "SELECT COUNT(*) FROM screening_result WHERE session_id = ? "
        "AND review_status IN ('Accepted', 'Overridden') "
        "AND final_classification IN ('Relevant', 'Partially Relevant')",
        (sid,),
    ).fetchone()[0]
    has_draft = _conn().execute(
        "SELECT status FROM review_draft WHERE session_id = ? ORDER BY draft_id DESC LIMIT 1",
        (sid,),
    ).fetchone()
    return {
        "session_id": sid,
        "research_question": row["research_question"],
        "corpus_version": row["corpus_version"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "papers_count": papers,
        "corpus_count": in_corpus,
        "draft_status": has_draft["status"] if has_draft else None,
    }


def list_sessions(limit: int = 20) -> list[dict]:
    """Danh sách session + số liệu tiến độ cho Dashboard.

    Phoenix-mentor review (PR #7): tránh N+1 query — 3 câu GROUP BY tổng
    hợp thay vì 3×N query con trong vòng lặp (N = số session hiển thị).
    """
    rows = (
        _conn()
        .execute(
            "SELECT session_id, research_question, corpus_version, created_at, updated_at "
            "FROM research_session ORDER BY updated_at DESC LIMIT ?",
            (limit,),
        )
        .fetchall()
    )
    sids = [r["session_id"] for r in rows]
    if not sids:
        return []

    # 1 query đếm paper theo session
    placeholders = ",".join("?" for _ in sids)
    papers_by = {
        r["session_id"]: r["n"]
        for r in _conn()
        .execute(
            f"SELECT session_id, COUNT(*) AS n FROM paper "
            f"WHERE session_id IN ({placeholders}) GROUP BY session_id",
            sids,
        )
        .fetchall()
    }
    # 1 query đếm corpus membership theo session
    corpus_by = {
        r["session_id"]: r["n"]
        for r in _conn()
        .execute(
            f"SELECT session_id, COUNT(*) AS n FROM screening_result "
            f"WHERE session_id IN ({placeholders}) "
            f"AND review_status IN ('Accepted', 'Overridden') "
            f"AND final_classification IN ('Relevant', 'Partially Relevant') "
            f"GROUP BY session_id",
            sids,
        )
        .fetchall()
    }
    # 1 query draft status mới nhất theo session (max draft_id)
    draft_by = {
        r["session_id"]: r["status"]
        for r in _conn()
        .execute(
            f"SELECT session_id, status FROM review_draft "
            f"WHERE draft_id IN (SELECT MAX(draft_id) FROM review_draft "
            f"WHERE session_id IN ({placeholders}) GROUP BY session_id)",
            sids,
        )
        .fetchall()
    }

    sessions = []
    for r in rows:
        sid = r["session_id"]
        sessions.append(
            {
                "session_id": sid,
                "research_question": r["research_question"],
                "corpus_version": r["corpus_version"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "papers_count": papers_by.get(sid, 0),
                "corpus_count": corpus_by.get(sid, 0),
                "draft_status": draft_by.get(sid),
            }
        )
    return sessions


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


# ---------------------------------------------------------------------------
# Screening (W2) — classification (AI) + review (user) + Confirmed Corpus.
# ---------------------------------------------------------------------------

_CORPUS_LABELS = ("Relevant", "Partially Relevant")


def save_screening_result(
    session_id: str,
    paper_id: str,
    classification_status: str,
    classification_error: str = "",
    ai_classification: str | None = None,
    reason: str = "",
    evidence: dict | None = None,
) -> None:
    """Lưu kết quả phân loại AI — classification_status tách khỏi review_status."""
    _conn().execute(
        "INSERT INTO screening_result (session_id, paper_id, classification_status, "
        "classification_error, ai_classification, reason, evidence_json, classified_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
        "ON CONFLICT (session_id, paper_id) DO UPDATE SET "
        "classification_status = excluded.classification_status, "
        "classification_error = excluded.classification_error, "
        "ai_classification = excluded.ai_classification, "
        "reason = excluded.reason, evidence_json = excluded.evidence_json, "
        "classified_at = excluded.classified_at",
        (
            session_id,
            paper_id,
            classification_status,
            classification_error,
            ai_classification,
            reason,
            __import__("json").dumps(evidence or {}, ensure_ascii=False),
            _now(),
        ),
    )
    _conn().commit()


def get_screening(session_id: str, paper_id: str) -> dict | None:
    row = (
        _conn()
        .execute(
            "SELECT * FROM screening_result WHERE session_id = ? AND paper_id = ?",
            (session_id, paper_id),
        )
        .fetchone()
    )
    return _screening_row(row) if row else None


def list_screening(session_id: str) -> list[dict]:
    rows = (
        _conn()
        .execute(
            "SELECT * FROM screening_result WHERE session_id = ? ORDER BY screening_id",
            (session_id,),
        )
        .fetchall()
    )
    return [_screening_row(r) for r in rows]


def _screening_row(row) -> dict:
    return {
        "paper_id": row["paper_id"],
        "classification_status": row["classification_status"],
        "classification_error": row["classification_error"],
        "ai_classification": row["ai_classification"],
        "reason": row["reason"],
        "evidence": json.loads(row["evidence_json"] or "{}"),
        "review_status": row["review_status"],
        "final_classification": row["final_classification"],
        "override_note": row["override_note"],
    }


def _membership(session_id: str, paper_id: str) -> bool:
    """FR-SCRN-07: corpus membership = Accepted/Overridden + final ∈ Relevant/Partially."""
    row = (
        _conn()
        .execute(
            "SELECT review_status, final_classification FROM screening_result WHERE session_id = ? AND paper_id = ?",
            (session_id, paper_id),
        )
        .fetchone()
    )
    if row is None:
        return False
    return row["review_status"] in ("Accepted", "Overridden") and row["final_classification"] in _CORPUS_LABELS


def _corpus_ids(session_id: str) -> set[str]:
    rows = _conn().execute("SELECT paper_id FROM screening_result WHERE session_id = ?", (session_id,)).fetchall()
    return {r["paper_id"] for r in rows if _membership(session_id, r["paper_id"])}


def apply_review_decision(
    session_id: str,
    paper_id: str,
    review_status: str,
    final_classification: str | None,
    override_note: str = "",
) -> int:
    """Áp quyết định Accept/Reject/Override của người dùng (FR-SCRN-04).

    ai_classification KHÔNG bị ghi đè. corpus_version chỉ tăng khi membership
    thực sự thay đổi (FR-SES-07). Trả về corpus_version sau khi áp.
    """
    before = _corpus_ids(session_id)
    _conn().execute(
        "UPDATE screening_result SET review_status = ?, final_classification = ?, "
        "override_note = ?, reviewed_at = ? WHERE session_id = ? AND paper_id = ?",
        (review_status, final_classification, override_note, _now(), session_id, paper_id),
    )
    _conn().commit()
    after = _corpus_ids(session_id)
    if before != after:
        _conn().execute(
            "UPDATE research_session SET corpus_version = corpus_version + 1, updated_at = ? WHERE session_id = ?",
            (_now(), session_id),
        )
        _conn().commit()
    return get_session(session_id)["corpus_version"]


def get_corpus(session_id: str) -> list[PaperOut]:
    """Confirmed Corpus hiện hành — danh sách paper (FR-SCRN-07)."""
    ids = _corpus_ids(session_id)
    if not ids:
        return []
    placeholders = ",".join("?" for _ in ids)
    rows = (
        _conn()
        .execute(
            f"SELECT * FROM paper WHERE session_id = ? AND paper_id IN ({placeholders})",
            (session_id, *ids),
        )
        .fetchall()
    )
    return [_row_to_paper(r) for r in rows]


# ---------------------------------------------------------------------------
# Paper Summary (W3) — 5 trường + provenance từng trường.
# ---------------------------------------------------------------------------


def save_summary(session_id: str, paper_id: str, summary: dict) -> None:
    """Lưu summary — mỗi trường có value/not_mentioned/provenance độc lập.

    LLM sinh lại summary không xóa cờ user_edited của trường người dùng đã
    sửa — giá trị của trường đó cũng không bị ghi đè âm thầm (FR-SES-05).
    """
    conn = _conn()
    existing = get_summary(session_id, paper_id)
    if existing and existing["user_edited"]:
        # giữ nguyên bản người dùng đã sửa; chỉ cập nhật trạng thái thực thi
        conn.execute(
            "UPDATE paper_summary SET summary_status = ?, generated_at = ? WHERE session_id = ? AND paper_id = ?",
            (summary["summary_status"], _now(), session_id, paper_id),
        )
        conn.commit()
        return
    conn.execute(
        "INSERT INTO paper_summary (session_id, paper_id, summary_status, "
        "fields_json, source_type, user_edited, truncated, generated_at) "
        "VALUES (?, ?, ?, ?, ?, 0, ?, ?) "
        "ON CONFLICT (session_id, paper_id) DO UPDATE SET "
        "summary_status = excluded.summary_status, fields_json = excluded.fields_json, "
        "source_type = excluded.source_type, truncated = excluded.truncated, "
        "generated_at = excluded.generated_at",
        (
            session_id,
            paper_id,
            summary["summary_status"],
            json.dumps(summary.get("fields", {}), ensure_ascii=False),
            summary.get("source_type", ""),
            summary.get("truncated", False),
            _now(),
        ),
    )
    conn.commit()


def get_summary(session_id: str, paper_id: str) -> dict | None:
    row = (
        _conn()
        .execute(
            "SELECT * FROM paper_summary WHERE session_id = ? AND paper_id = ?",
            (session_id, paper_id),
        )
        .fetchone()
    )
    return _summary_row(row) if row else None


def list_summaries(session_id: str) -> list[dict]:
    rows = (
        _conn()
        .execute(
            "SELECT * FROM paper_summary WHERE session_id = ? ORDER BY generated_at",
            (session_id,),
        )
        .fetchall()
    )
    return [_summary_row(r) for r in rows]


def _summary_row(row) -> dict:
    return {
        "paper_id": row["paper_id"],
        "summary_status": row["summary_status"],
        "fields": json.loads(row["fields_json"] or "{}"),
        "source_type": row["source_type"],
        "user_edited": bool(row["user_edited"]),
        "truncated": bool(row["truncated"]),
    }


def update_summary_field(session_id: str, paper_id: str, field_name: str, value: str) -> dict | None:
    """Sửa một trường — đánh dấu user_edited, giữ provenance gốc (FR-SUMM-05)."""
    summary = get_summary(session_id, paper_id)
    if summary is None or field_name not in summary["fields"]:
        return None
    conn = _conn()
    summary["fields"][field_name]["value"] = value
    summary["fields"][field_name]["user_edited"] = True
    summary["user_edited"] = True
    conn.execute(
        "UPDATE paper_summary SET fields_json = ?, user_edited = 1 WHERE session_id = ? AND paper_id = ?",
        (json.dumps(summary["fields"], ensure_ascii=False), session_id, paper_id),
    )
    conn.commit()
    return summary


# ---------------------------------------------------------------------------
# RAG Exchange (W4) — lịch sử giữ nguyên tại thời điểm hỏi (FR-RAG-12).
# ---------------------------------------------------------------------------


def save_rag_exchange(session_id: str, question: str, result: dict) -> dict:
    conn = _conn()
    now = _now()
    conn.execute(
        "INSERT INTO rag_exchange (session_id, question, answer, answer_status, "
        "citations_json, corpus_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            session_id,
            question,
            result["answer"],
            result["answer_status"],
            json.dumps(result.get("citations", []), ensure_ascii=False),
            result["corpus_version"],
            now,
        ),
    )
    conn.commit()
    return {
        "exchange_id": conn.execute("SELECT last_insert_rowid()").fetchone()[0],
        "session_id": session_id,
        "question": question,
        "answer": result["answer"],
        "answer_status": result["answer_status"],
        "citations": result.get("citations", []),
        "corpus_version": result["corpus_version"],
        "created_at": now,
    }


def list_rag_exchanges(session_id: str) -> list[dict]:
    rows = (
        _conn()
        .execute(
            "SELECT * FROM rag_exchange WHERE session_id = ? ORDER BY exchange_id DESC LIMIT 50",
            (session_id,),
        )
        .fetchall()
    )
    return [
        {
            "exchange_id": r["exchange_id"],
            "question": r["question"],
            "answer": r["answer"],
            "answer_status": r["answer_status"],
            "citations": json.loads(r["citations_json"] or "[]"),
            "corpus_version": r["corpus_version"],
            "created_at": r["created_at"],
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Review Draft (W4) — Synthesis + Matrix + claims; approval ở trang Review.
# ---------------------------------------------------------------------------


def save_draft(session_id: str, draft: dict) -> dict:
    conn = _conn()
    now = _now()
    import hashlib

    content_hash = hashlib.sha256(draft["content"].encode()).hexdigest()
    conn.execute(
        "INSERT INTO review_draft (session_id, content, matrix_json, claims_json, "
        "unsupported_count, status, corpus_version, content_hash, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, 'Pending Review', ?, ?, ?, ?)",
        (
            session_id,
            draft["content"],
            json.dumps(draft.get("matrix", []), ensure_ascii=False),
            json.dumps(draft.get("claims", []), ensure_ascii=False),
            draft.get("unsupported_count", 0),
            draft["corpus_version"],
            content_hash,
            now,
            now,
        ),
    )
    conn.commit()
    return get_latest_draft(session_id)


def get_latest_draft(session_id: str) -> dict | None:
    row = (
        _conn()
        .execute(
            "SELECT * FROM review_draft WHERE session_id = ? ORDER BY draft_id DESC LIMIT 1",
            (session_id,),
        )
        .fetchone()
    )
    return _draft_row(row) if row else None


def _draft_row(row) -> dict:
    return {
        "draft_id": row["draft_id"],
        "session_id": row["session_id"],
        "content": row["content"],
        "matrix": json.loads(row["matrix_json"] or "[]"),
        "claims": json.loads(row["claims_json"] or "[]"),
        "unsupported_count": row["unsupported_count"],
        "status": row["status"],
        "corpus_version": row["corpus_version"],
        "content_hash": row["content_hash"],
        "created_at": row["created_at"],
    }


def set_draft_status(session_id: str, draft_id: int, status: str) -> dict | None:
    _conn().execute(
        "UPDATE review_draft SET status = ?, updated_at = ? WHERE session_id = ? AND draft_id = ?",
        (status, _now(), session_id, draft_id),
    )
    _conn().commit()
    return get_latest_draft(session_id)

# ---------------------------------------------------------------------------
# Approval Snapshot & Export Record (W5 — PRD v1.1 mục 11.2 Approval/Export).
# ---------------------------------------------------------------------------

def create_approval_snapshot(session_id: str, draft_id: int) -> dict | None:
    """Tạo Approval Snapshot bất biến khi người dùng duyệt (FR-APR-02).

    - approved_content_snapshot: nội dung canonical bất biến (content + matrix
      + claims của draft tại thời điểm duyệt).
    - approved_content_hash: hash canonical content.
    - approved_corpus_version: corpus version HIỆN HÀNH của session tại thời
      điểm duyệt (FR-APR-02) — không phải corpus version lúc tạo draft.
    Snapshot Active duy nhất cho một draft; approve lại → snapshot cũ invalidated.
    """
    draft = get_draft_by_id(session_id, draft_id)
    if draft is None:
        return None
    if draft["unsupported_count"] > 0:
        return {"error": "unsupported_claims", "unsupported_count": draft["unsupported_count"]}

    conn = _conn()
    now = _now()
    # FR-APR-03/07: approve lại cùng draft → snapshot cũ invalidated
    conn.execute(
        "UPDATE approval_snapshot SET status = 'Invalidated' "
        "WHERE session_id = ? AND draft_id = ? AND status = 'Active'",
        (session_id, draft_id),
    )
    import hashlib

    content_hash = hashlib.sha256(draft["content"].encode()).hexdigest()
    snapshot = {
        "content": draft["content"],
        "comparison_matrix": draft["matrix"],
        "claims": draft["claims"],
    }
    # FR-APR-02: approved_corpus_version = corpus version HIỆN HÀNH của session
    current_corpus_version = get_session(session_id)["corpus_version"]
    conn.execute(
        "INSERT INTO approval_snapshot (session_id, draft_id, approved_version, "
        "approved_content_snapshot, approved_content_hash, approved_corpus_version, "
        "status, approved_at) VALUES (?, ?, 1, ?, ?, ?, 'Active', ?)",
        (
            session_id,
            draft_id,
            json.dumps(snapshot, ensure_ascii=False),
            content_hash,
            current_corpus_version,
            now,
        ),
    )
    conn.execute(
        "UPDATE review_draft SET status = 'Approved', updated_at = ? "
        "WHERE session_id = ? AND draft_id = ?",
        (now, session_id, draft_id),
    )
    conn.commit()
    return get_active_approval(session_id, draft_id)


def get_active_approval(session_id: str, draft_id: int) -> dict | None:
    row = _conn().execute(
        "SELECT * FROM approval_snapshot WHERE session_id = ? AND draft_id = ? "
        "AND status = 'Active' ORDER BY approval_id DESC LIMIT 1",
        (session_id, draft_id),
    ).fetchone()
    return _approval_row(row) if row else None


def get_draft_by_id(session_id: str, draft_id: int) -> dict | None:
    row = _conn().execute(
        "SELECT * FROM review_draft WHERE session_id = ? AND draft_id = ?",
        (session_id, draft_id),
    ).fetchone()
    return _draft_row(row) if row else None


def invalidate_approval_for_session(session_id: str) -> int:
    """FR-APR-08: corpus_version đổi → invalidate mọi snapshot Active của session.

    Trả số snapshot bị invalidate. Gọi ở route khi screen/review làm membership đổi.
    """
    conn = _conn()
    cur = conn.execute(
        "UPDATE approval_snapshot SET status = 'Invalidated' "
        "WHERE session_id = ? AND status = 'Active'",
        (session_id,),
    )
    conn.commit()
    return cur.rowcount


def _approval_row(row) -> dict:
    return {
        "approval_id": row["approval_id"],
        "session_id": row["session_id"],
        "draft_id": row["draft_id"],
        "approved_version": row["approved_version"],
        "approved_content_snapshot": json.loads(row["approved_content_snapshot"] or "{}"),
        "approved_content_hash": row["approved_content_hash"],
        "approved_corpus_version": row["approved_corpus_version"],
        "status": row["status"],
        "approved_at": row["approved_at"],
    }


def invalidate_stale_approvals(session_id: str, current_corpus_version: int) -> int:
    """FR-APR-08: snapshot Active nhưng approved_corpus_version khác corpus hiện
    hành → invalidate. Trả số snapshot bị invalidate."""
    conn = _conn()
    cur = conn.execute(
        "UPDATE approval_snapshot SET status = 'Invalidated' "
        "WHERE session_id = ? AND status = 'Active' AND approved_corpus_version != ?",
        (session_id, current_corpus_version),
    )
    conn.commit()
    return cur.rowcount


def save_export_record(approval_id: int, file_name: str, export_file_hash: str) -> dict:
    """FR-APR-05: mỗi file DOCX một Export Record riêng, không ghi đè."""
    conn = _conn()
    now = _now()
    conn.execute(
        "INSERT INTO export_record (approval_id, file_name, export_file_hash, exported_at) "
        "VALUES (?, ?, ?, ?)",
        (approval_id, file_name, export_file_hash, now),
    )
    conn.commit()
    return {
        "export_id": conn.execute("SELECT last_insert_rowid()").fetchone()[0],
        "approval_id": approval_id,
        "file_name": file_name,
        "export_file_hash": export_file_hash,
        "exported_at": now,
    }


def list_export_records(approval_id: int) -> list[dict]:
    rows = _conn().execute(
        "SELECT * FROM export_record WHERE approval_id = ? ORDER BY export_id DESC",
        (approval_id,),
    ).fetchall()
    return [
        {
            "export_id": r["export_id"],
            "approval_id": r["approval_id"],
            "file_name": r["file_name"],
            "export_file_hash": r["export_file_hash"],
            "exported_at": r["exported_at"],
        }
        for r in rows
    ]

def update_draft_content(session_id: str, draft_id: int, content: str) -> dict | None:
    """Sửa nội dung draft (FR-APR-03/07): content mới + hash mới + về Pending Review.

    Điểm DUY NHẤT được phép sửa content — bảo đảm content_hash luôn khớp content.
    """
    import hashlib

    conn = _conn()
    now = _now()
    content_hash = hashlib.sha256(content.encode()).hexdigest()
    conn.execute(
        "UPDATE review_draft SET content = ?, content_hash = ?, status = 'Pending Review', "
        "updated_at = ? WHERE session_id = ? AND draft_id = ?",
        (content, content_hash, now, session_id, draft_id),
    )
    conn.commit()
    return get_draft_by_id(session_id, draft_id)

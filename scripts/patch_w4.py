"""One-shot patcher — thêm generator store + routes + schemas (W4). Chạy từ repo root."""

from pathlib import Path

# 1. session_store: bảng review_draft + hàm
store = Path("src/services/session_store.py")
src = store.read_text(encoding="utf-8")
anchor = "CREATE TABLE IF NOT EXISTS rag_exchange ("
add_table = """CREATE TABLE IF NOT EXISTS review_draft (
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

CREATE TABLE IF NOT EXISTS rag_exchange ("""
assert anchor in src, "anchor rag_exchange not found"
src = src.replace(anchor, add_table, 1)

draft_code = '''

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
    row = _conn().execute(
        "SELECT * FROM review_draft WHERE session_id = ? ORDER BY draft_id DESC LIMIT 1",
        (session_id,),
    ).fetchone()
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
'''
src = src.rstrip() + draft_code
store.write_text(src, encoding="utf-8")
print("store OK")

# 2. routes
routes = Path("src/api/routes.py")
r = routes.read_text(encoding="utf-8")
addition = '''

# ---------------------------------------------------------------------------
# Literature Review Generator (W4): Matrix + Synthesis Draft.
# ---------------------------------------------------------------------------

from src.models.schemas import (  # noqa: E402
    DraftStatusRequest,
    GenerateRequest,
    GenerateResponse,
)
from src.services import generator_service  # noqa: E402


@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """Tạo Comparison Matrix + Synthesis Draft từ corpus (FR-GEN-01..04).

    - Matrix deterministic từ Summary; paper chưa có Summary -> Not available.
    - Synthesis qua LLM; claims resolve về paper trong corpus; khong resolve ->
      support_status unsupported (FR-GEN-03/06) — approval se chan (W5).
    - Khong phu thuoc RAG history (FR-GEN-02).
    """
    session = session_store.get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    corpus = session_store.get_corpus(request.session_id)
    if not corpus:
        raise HTTPException(
            status_code=422,
            detail="Confirmed Corpus rỗng — screening + review trước khi Generate (FR-GEN-02)",
        )

    summaries = {s["paper_id"]: s for s in session_store.list_summaries(request.session_id)}
    result = await generator_service.generate_draft(session["research_question"], corpus, summaries)
    saved = session_store.save_draft(
        request.session_id,
        {
            "content": result.get("draft_markdown", ""),
            "matrix": result.get("matrix", []),
            "claims": result.get("claims", []),
            "unsupported_count": result.get("unsupported_count", 0),
            "corpus_version": session["corpus_version"],
        },
    )
    return GenerateResponse(
        session_id=request.session_id,
        generation_status=result["generation_status"],
        generation_error=result.get("generation_error", ""),
        **saved,
    )


@router.get("/sessions/{session_id}/draft")
async def get_draft(session_id: str):
    """Draft mới nhất của session — restore (FR-SES-04)."""
    if session_store.get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    draft = session_store.get_latest_draft(session_id)
    if draft is None:
        return {"session_id": session_id, "generation_status": "no_draft"}
    return draft


@router.post("/sessions/{session_id}/draft/status")
async def update_draft_status(session_id: str, request: DraftStatusRequest):
    """Đổi trạng thái draft (Approve ở trang Review — W5 thêm snapshot/hash)."""
    if session_store.get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    draft = session_store.set_draft_status(session_id, request.draft_id, request.status)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft không tồn tại")
    return draft
'''
r = r.rstrip() + addition
routes.write_text(r, encoding="utf-8")
print("routes OK")

# 3. schemas
schemas = Path("src/models/schemas.py")
s = schemas.read_text(encoding="utf-8").rstrip() + '''

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
'''
schemas.write_text(s + "\n", encoding="utf-8")
print("schemas OK")

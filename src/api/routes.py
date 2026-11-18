"""API routes v2 — truyền thread_id cho checkpointer để HITL resume hoạt động.

Vì sao đổi: graph v2 compile với MemorySaver — invoke bắt buộc có
`config={"configurable": {"thread_id": ...}}`. Client giữ session_id,
gửi lại kèm Command(resume=...) khi user duyệt/từ chối hành động rủi ro.
"""

import logging

from fastapi import APIRouter, HTTPException
from langgraph.types import Command
from pydantic import BaseModel

from src.agents.graph import agent
from src.models.schemas import ChatRequest, ChatResponse

logger = logging.getLogger("ai20k.api")

router = APIRouter()


def _config(session_id: str) -> dict:
    return {"configurable": {"thread_id": session_id}}


def _to_chat_response(result: dict, session_id: str) -> ChatResponse:
    # Cả /chat lẫn /chat/resume đều có thể dừng ở interrupt (vd agent muốn gửi email thứ 2)
    if "__interrupt__" in result:
        interrupts = result["__interrupt__"]
        payload = getattr(interrupts[0], "value", interrupts[0])
        return ChatResponse(
            response=f"[CẦN PHÊ DUYỆT] {payload}. POST /chat/resume với resume='approve' hoặc 'reject'.",
            analysis="HITL interrupt",
            session_id=session_id,
        )
    trace = result.get("tool_trace", [])
    analysis = "; ".join(f"{t['tool']}({t['args']}) -> {str(t['output'])[:60]}" for t in trace)
    return ChatResponse(response=result.get("response", ""), analysis=analysis, session_id=session_id)


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Chat với AI agent. Nếu agent đang chờ human review, response chứa hướng dẫn resume."""
    try:
        result = await agent.ainvoke({"query": request.message}, config=_config(request.session_id))
        return _to_chat_response(result, request.session_id)
    except Exception as exc:
        logger.error("FAILED /chat — %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class ResumeRequest(BaseModel):
    session_id: str  # bắt buộc — lấy từ ChatResponse.session_id của /chat
    resume: str  # "approve" | "reject"


@router.post("/chat/resume", response_model=ChatResponse)
async def chat_resume(request: ResumeRequest) -> ChatResponse:
    """Resume sau HITL interrupt — phê duyệt hoặc từ chối hành động rủi ro."""
    try:
        result = await agent.ainvoke(Command(resume=request.resume), config=_config(request.session_id))
        return _to_chat_response(result, request.session_id)
    except Exception as exc:
        logger.error("FAILED /chat/resume — %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/status")
async def agent_status():
    """Kiểm tra trạng thái agent."""
    return {"status": "ready", "agent": "LangGraph Agent v2.0"}


# ---------------------------------------------------------------------------
# Research Session & Academic Search (W1 — PRD v1.1 mục 11.2)
# ---------------------------------------------------------------------------

from src.models.schemas import (  # noqa: E402 — import cùng khối route mới
    AddPapersRequest,
    AddPapersResponse,
    SearchRequest,
    SearchResponse,
    SessionCreateRequest,
    SessionOut,
)
from src.services import openalex as openalex_service  # noqa: E402
from src.services import session_store  # noqa: E402


@router.post("/sessions", response_model=SessionOut)
async def create_session(request: SessionCreateRequest):
    """Tạo Research Session với Research Question (FR-SES-01)."""
    session = session_store.create_session(request.message, request.session_id)
    return SessionOut(**session)


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(limit: int = 20):
    """Danh sách session gần đây — Dashboard cần cho hiển thị project gần đây."""
    return [SessionOut(**s) for s in session_store.list_sessions(limit)]


@router.get("/sessions/{session_id}", response_model=SessionOut)
async def get_session(session_id: str):
    """Lấy session — session restore sau restart (FR-SES-02)."""
    session = session_store.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    return SessionOut(**session)


@router.post("/search", response_model=SearchResponse)
async def search_papers(request: SearchRequest):
    """Search OpenAlex — FR-SRCH-01/02/05/06. Lỗi trả error + retry, không kết quả dở."""
    if session_store.get_session(request.session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    try:
        papers, total = await openalex_service.search(request.query, request.max_results)
    except openalex_service.OpenAlexError as exc:
        logger.warning("OpenAlex failed for session %s: %s", request.session_id, exc)
        return SearchResponse(
            session_id=request.session_id,
            query=request.query,
            results=[],
            total_results=0,
            truncated=False,
            error=str(exc),
        )
    return SearchResponse(
        session_id=request.session_id,
        query=request.query,
        results=papers,
        total_results=total,
    )


@router.post("/sessions/papers", response_model=AddPapersResponse)
async def add_papers_to_session(request: AddPapersRequest):
    """Thêm paper vào Working Set — FR-SRCH-03/04 (dedupe OpenAlex ID/DOI chuẩn hóa)."""
    if session_store.get_session(request.session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    # Paper search result không có session — fetch chi tiết từ OpenAlex theo ID.
    candidates: list = []
    for pid in request.paper_ids:
        paper = session_store.get_paper(request.session_id, pid)
        if paper is not None:
            # đã trong session → route qua dedupe để trả skipped thay vì lỗi
            candidates.append(paper)
            continue
        try:
            match = await openalex_service.get_by_id(pid)
        except openalex_service.OpenAlexError as exc:
            logger.warning("OpenAlex fetch %s failed: %s", pid, exc)
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        if match is None:
            raise HTTPException(status_code=404, detail=f"Paper {pid} không tìm thấy trên OpenAlex")
        candidates.append(match)

    added, skipped = session_store.upsert_papers(request.session_id, candidates)
    return AddPapersResponse(
        session_id=request.session_id,
        added=added,
        skipped_duplicates=skipped,
        working_set=session_store.get_working_set(request.session_id),
    )


@router.get("/sessions/{session_id}/papers", response_model=list)
async def get_working_set(session_id: str):
    """Working Set của session — session isolation, 404 nếu session không tồn tại."""
    if session_store.get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    return session_store.get_working_set(session_id)


# ---------------------------------------------------------------------------
# Smart Screening (W2 — PRD v1.1 mục 11.2): phân loại AI + user review.
# ---------------------------------------------------------------------------

from src.models.schemas import (  # noqa: E402
    ReviewDecisionRequest,
    ReviewDecisionResponse,
    ScreeningItemOut,
    ScreenRequest,
    ScreenResponse,
)
from src.services import screening as screening_service  # noqa: E402


@router.post("/screen", response_model=ScreenResponse)
async def screen_papers(request: ScreenRequest):
    """Phân loại AI các paper trong Working Set (FR-SCRN-01..09).

    Batch tối đa 10 paper/lần; chỉ screen paper chưa có kết quả completed
    trừ khi chỉ định paper_ids cụ thể. Lỗi kỹ thuật trả classification_status
    failed/timeout — không gán nhãn nghiệp vụ giả.
    """
    session = session_store.get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    working_set = {p.paper_id: p for p in session_store.get_working_set(request.session_id)}
    existing = {s["paper_id"]: s for s in session_store.list_screening(request.session_id)}

    # Chọn paper cần screen: chỉ định trước hoặc chưa có kết quả completed
    if request.paper_ids:
        targets = [working_set[pid] for pid in request.paper_ids if pid in working_set]
        missing = [pid for pid in request.paper_ids if pid not in working_set]
        if missing:
            raise HTTPException(status_code=404, detail=f"Paper không trong Working Set: {missing}")
    else:
        targets = [
            p for pid, p in working_set.items() if existing.get(pid, {}).get("classification_status") != "completed"
        ][:10]  # batch 10 (PRD mục 10.3)

    results: list[ScreeningItemOut] = []
    # Giữ kết quả đã có của các paper không được screen lần này
    for pid, p in working_set.items():
        if p not in targets and pid in existing:
            results.append(ScreeningItemOut(title=p.title, **existing[pid]))

    for paper in targets:
        outcome = await screening_service.classify_paper(paper, session["research_question"])
        session_store.save_screening_result(
            request.session_id,
            paper.paper_id,
            classification_status=outcome["classification_status"],
            classification_error=outcome.get("classification_error", ""),
            ai_classification=outcome.get("ai_classification"),
            reason=outcome.get("reason", ""),
            evidence=outcome.get("evidence"),
        )
        stored = session_store.get_screening(request.session_id, paper.paper_id)
        results.append(ScreeningItemOut(title=paper.title, **stored))

    summary = screening_service.summarize_batch([r.model_dump() for r in results])
    return ScreenResponse(session_id=request.session_id, results=results, summary=summary)


@router.get("/sessions/{session_id}/screening", response_model=list[ScreeningItemOut])
async def get_screening_results(session_id: str):
    """Kết quả screening đã lưu của session — restore sau reload (FR-SES-04)."""
    if session_store.get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    working = {p.paper_id: p for p in session_store.get_working_set(session_id)}
    items = []
    for s in session_store.list_screening(session_id):
        paper = working.get(s["paper_id"])
        items.append(ScreeningItemOut(title=paper.title if paper else "(paper đã xóa)", **s))
    return items


@router.post("/screen/review", response_model=ReviewDecisionResponse)
async def review_decision(request: ReviewDecisionRequest):
    """Áp quyết định Accept/Reject/Override của người dùng (FR-SCRN-04).

    - Accept: chỉ hợp lệ cho nhãn judged (Relevant/Partially Relevant/Not
      Relevant); Insufficient Evidence KHÔNG được Accept trực tiếp (FR-SCRN-05).
    - Override: bắt buộc kèm final_classification trong 3 nhãn judged.
    - ai_classification không bao giờ bị ghi đè.
    - corpus_version chỉ tăng khi membership thay đổi (FR-SES-07).
    """
    if session_store.get_session(request.session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    stored = session_store.get_screening(request.session_id, request.paper_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Paper chưa được screening")

    ai_label = stored.get("ai_classification")
    decision = request.decision

    if decision == "accept":
        if ai_label not in ("Relevant", "Partially Relevant", "Not Relevant"):
            raise HTTPException(
                status_code=422,
                detail="Không thể Accept 'Insufficient Evidence' — dùng Reject hoặc Override (FR-SCRN-05)",
            )
        review_status, final = "Accepted", ai_label
    elif decision == "reject":
        review_status, final = "Rejected", None
    else:  # override
        if request.final_classification not in ("Relevant", "Partially Relevant", "Not Relevant"):
            raise HTTPException(
                status_code=422,
                detail="Override phải kèm final_classification trong 3 nhãn: Relevant / Partially Relevant / Not Relevant",
            )
        review_status, final = "Overridden", request.final_classification

    corpus_version = session_store.apply_review_decision(
        request.session_id,
        request.paper_id,
        review_status,
        final,
        request.override_note,
    )
    in_corpus = final in ("Relevant", "Partially Relevant") and review_status in ("Accepted", "Overridden")
    return ReviewDecisionResponse(
        session_id=request.session_id,
        paper_id=request.paper_id,
        review_status=review_status,
        final_classification=final,
        corpus_version=corpus_version,
        in_corpus=in_corpus,
    )


@router.get("/sessions/{session_id}/corpus", response_model=list)
async def get_corpus(session_id: str):
    """Confirmed Corpus hiện hành — input của Summary/RAG/Generator (FR-SCRN-07)."""
    if session_store.get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    return session_store.get_corpus(session_id)


# ---------------------------------------------------------------------------
# Paper Summarization (W3 — PRD v1.1 mục 11.2): 5 trường + provenance.
# ---------------------------------------------------------------------------

from src.models.schemas import (  # noqa: E402
    SummaryRequest,
    SummaryResponse,
    SummaryUpdateRequest,
)
from src.services import summary_service  # noqa: E402


@router.post("/summary", response_model=SummaryResponse)
async def summarize(request: SummaryRequest):
    """Tạo summary 5 trường cho một paper trong corpus (FR-SUMM-01..08).

    Paper metadata-only → 4 trường M/D/R/F là not_mentioned, không gọi LLM.
    Lỗi kỹ thuật sau retry → summary_status failed/timeout, không có fields giả.
    """
    if session_store.get_session(request.session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    paper = session_store.get_paper(request.session_id, request.paper_id)
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper không trong session")

    summary = await summary_service.summarize_paper(paper)
    session_store.save_summary(request.session_id, request.paper_id, summary)
    stored = session_store.get_summary(request.session_id, request.paper_id)
    assert stored is not None
    return SummaryResponse(
        session_id=request.session_id,
        **{"paper_id": request.paper_id, **stored},
    )


@router.get("/sessions/{session_id}/summaries", response_model=list)
async def get_summaries(session_id: str):
    """Toàn bộ summary của session — restore sau reload (FR-SES-04)."""
    if session_store.get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    return session_store.list_summaries(session_id)


@router.patch("/sessions/{session_id}/papers/{paper_id}/summary")
async def edit_summary_field(session_id: str, paper_id: str, request: SummaryUpdateRequest):
    """Sửa một trường summary — user_edited flag, giữ provenance gốc (FR-SUMM-05)."""
    if session_store.get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    updated = session_store.update_summary_field(session_id, paper_id, request.field_name, request.value)
    if updated is None:
        raise HTTPException(status_code=404, detail="Summary hoặc trường không tồn tại")
    return {"session_id": session_id, "paper_id": paper_id, **updated}


# ---------------------------------------------------------------------------
# Evidence-based RAG (W4 — PRD v1.1 mục 11.2): hỏi đáp trên corpus hiện hành.
# ---------------------------------------------------------------------------

from src.models.schemas import (  # noqa: E402
    RAGRequest,
    RAGResponse,
)
from src.services import rag_service  # noqa: E402


@router.post("/rag", response_model=RAGResponse)
async def rag_ask(request: RAGRequest):
    """Hỏi đáp trên Confirmed Corpus hiện hành (FR-RAG-01..08).

    - Evidence Chunk dựng từ abstract của corpus; retrieval top-k cố định.
    - Không chunk khớp → no_matching_evidence + citations rỗng (FR-RAG-06/08).
    - Lịch sử RAG Exchange lưu corpus_version + evidence snapshot (FR-RAG-12).
    """
    session = session_store.get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")

    corpus = session_store.get_corpus(request.session_id)
    if not corpus:
        return RAGResponse(
            session_id=request.session_id,
            question=request.question,
            answer_status="no_matching_evidence",
            answer="Confirmed Corpus rỗng — screening và review paper trước khi hỏi (FR-RAG-01).",
            citations=[],
            corpus_version=session["corpus_version"],
        )

    chunks_with_paper = []
    for paper in corpus:
        chunks_with_paper.extend((c, paper) for c in rag_service.build_chunks(paper, request.session_id))

    result = await rag_service.answer_question(
        request.question,
        session["research_question"],
        chunks_with_paper,
        session["corpus_version"],
    )
    saved = session_store.save_rag_exchange(request.session_id, request.question, result)
    return RAGResponse(**saved)


@router.get("/sessions/{session_id}/rag", response_model=list)
async def get_rag_history(session_id: str):
    """Lịch sử RAG — giữ nguyên nội dung tại thời điểm hỏi (FR-RAG-12)."""
    if session_store.get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    return session_store.list_rag_exchanges(session_id)


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

# ---------------------------------------------------------------------------
# Approval & Export (W5 — PRD v1.1 mục 11.2): snapshot bất biến + DOCX.
# ---------------------------------------------------------------------------

from src.models.schemas import (  # noqa: E402
    ApproveRequest,
    ApproveResponse,
    ExportResponse,
)
from src.services import docx_service  # noqa: E402


@router.post("/draft/approve", response_model=ApproveResponse)
async def approve_draft(request: ApproveRequest):
    """Phê duyệt draft — tạo Approval Snapshot bất biến (FR-APR-01/02).

    Chặn approval nếu draft còn claim unsupported (FR-APR-09, FR-GEN-06/11).
    Snapshot Active cũ của cùng draft bị invalidated khi approve lại.
    """
    if session_store.get_session(request.session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    result = session_store.create_approval_snapshot(request.session_id, request.draft_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Draft không tồn tại")
    if result.get("error") == "unsupported_claims":
        raise HTTPException(
            status_code=422,
            detail=(
                f"Không thể duyệt: draft còn {result['unsupported_count']} claim "
                "unsupported — phải chỉnh sửa/loại bỏ trước (FR-APR-09)"
            ),
        )
    assert result is not None and "approval_id" in result
    return ApproveResponse(**result)


@router.get("/sessions/{session_id}/approval")
async def get_approval(session_id: str, draft_id: int):
    """Snapshot Active của draft (nếu có) — trang Review hiển thị trạng thái."""
    if session_store.get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    approval = session_store.get_active_approval(session_id, draft_id)
    if approval is None:
        return {"session_id": session_id, "draft_id": draft_id, "status": "no_approval"}
    return approval


@router.get("/sessions/{session_id}/exports")
async def get_exports(session_id: str, approval_id: int):
    """Export Records của một approval — lịch sử file DOCX đã sinh (FR-APR-05)."""
    if session_store.get_session(session_id) is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    return session_store.list_export_records(approval_id)


@router.post("/export", response_model=ExportResponse)
async def export_docx(request: ApproveRequest):
    """Sinh file DOCX từ Approval Snapshot (FR-APR-04/05).

    Điều kiện đồng thời (FR-APR-04): draft Approved; snapshot Active; canonical
    hash khớp; corpus_version hiện hành khớp approved_corpus_version. Không gọi
    LLM. Mỗi lần export tạo một Export Record với export_file_hash riêng.
    """
    session = session_store.get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    draft = session_store.get_draft_by_id(request.session_id, request.draft_id)
    if draft is None:
        raise HTTPException(status_code=404, detail="Draft không tồn tại")
    approval = session_store.get_active_approval(request.session_id, request.draft_id)
    if approval is None or approval["status"] != "Active":
        raise HTTPException(status_code=422, detail="Chưa có Approval Snapshot hợp lệ — approve trước (FR-APR-04)")
    if draft["status"] != "Approved":
        raise HTTPException(status_code=422, detail="Draft không ở trạng thái Approved (FR-APR-04a)")
    if draft["content_hash"] != approval["approved_content_hash"]:
        raise HTTPException(status_code=422, detail="Draft đã thay đổi sau approval (FR-APR-04b)")
    if session["corpus_version"] != approval["approved_corpus_version"]:
        raise HTTPException(
            status_code=422,
            detail=f"Corpus đã thay đổi (v{session['corpus_version']} ≠ v{approval['approved_corpus_version']}) — rebuild + approve lại (FR-APR-04c)",
        )

    # Sinh DOCX từ SNAPSHOT (không phải draft hiện hành) — FR-APR-05
    corpus = session_store.get_corpus(request.session_id)
    papers_by_id = {
        p.paper_id: {"title": p.title, "authors": p.authors, "year": p.year, "venue": p.venue, "doi": p.doi}
        for p in corpus
    }
    docx_bytes = docx_service.build_docx(
        session["research_question"],
        approval["approved_content_snapshot"],
        papers_by_id,
    )
    file_name = docx_service.export_file_name(approval["approval_id"], request.session_id)
    record = session_store.save_export_record(
        approval["approval_id"], file_name, docx_service.file_hash(docx_bytes)
    )
    import base64

    return ExportResponse(
        **record,
        file_base64=base64.b64encode(docx_bytes).decode(),
        approved_content_hash=approval["approved_content_hash"],
    )


@router.post("/sessions/{session_id}/invalidate-approvals")
async def invalidate_approvals(session_id: str):
    """FR-APR-08: corpus_version đổi → invalidate snapshot Active không khớp.

    Gọi tự động sau mỗi review decision; endpoint này để admin/debug.
    """
    session = session_store.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session không tồn tại")
    count = session_store.invalidate_stale_approvals(session_id, session["corpus_version"])
    return {"session_id": session_id, "invalidated": count}

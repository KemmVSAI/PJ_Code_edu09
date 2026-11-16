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

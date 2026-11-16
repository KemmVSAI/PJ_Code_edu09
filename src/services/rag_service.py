"""Evidence Chunk + RAG service — W4 theo PRD v1.1 mục 11.2 (RAG).

Quy tắc bắt buộc (PRD):
- Evidence Chunk: trích NGUYÊN VĂN từ abstract đã lưu, source_type luôn
  'abstract'; segmentation deterministic (chia theo câu, gộp ~2 câu/chunk).
- answer_status ∈ {sufficient_evidence, insufficient_evidence, no_matching_evidence}.
- Evidence truy xuất từ corpus hiện hành; câu hỏi ngoài phạm vi →
  no_matching_evidence + citations rỗng, KHÔNG suy diễn.
- RAG Exchange lưu corpus_version + evidence snapshot tại thời điểm hỏi.
- Điểm retrieval không hiển thị như độ chính xác.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field, ValidationError

from src.services.llm import get_llm
from src.services.session_store import PaperOut

logger = logging.getLogger("ai20k.rag")

AnswerStatus = Literal["sufficient_evidence", "insufficient_evidence", "no_matching_evidence"]


@dataclass
class EvidenceChunk:
    chunk_id: str
    paper_id: str
    session_id: str
    content: str
    position: int  # index câu bắt đầu trong abstract


def build_chunks(paper: PaperOut, session_id: str, max_words: int = 60) -> list[EvidenceChunk]:
    """Chia abstract thành chunks theo câu — deterministic, dễ kiểm thử.

    Gộp câu liền kề tới khi vượt max_words; câu quá dài đứng riêng.
    Paper metadata-only → không có chunk.
    """
    if paper.source_type != "abstract" or not paper.abstract.strip():
        return []
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", paper.abstract.strip()) if s.strip()]
    chunks: list[EvidenceChunk] = []
    buf: list[str] = []
    buf_start = 0
    for i, sentence in enumerate(sentences):
        if not buf:
            buf_start = i
        buf.append(sentence)
        if sum(len(s.split()) for s in buf) >= max_words:
            chunks.append(
                EvidenceChunk(
                    chunk_id=f"{paper.paper_id}_c{len(chunks) + 1}",
                    paper_id=paper.paper_id,
                    session_id=session_id,
                    content=" ".join(buf),
                    position=buf_start,
                )
            )
            buf = []
    if buf:
        chunks.append(
            EvidenceChunk(
                chunk_id=f"{paper.paper_id}_c{len(chunks) + 1}",
                paper_id=paper.paper_id,
                session_id=session_id,
                content=" ".join(buf),
                position=buf_start,
            )
        )
    return chunks


def keyword_retrieve(chunks: list[EvidenceChunk], question: str, top_k: int = 5) -> list[tuple[EvidenceChunk, float]]:
    """Retrieval từ khóa đơn giản, deterministic — đủ cho MVP (PRD mục 8: DB chunk store).

    Điểm chỉ dùng để sắp xếp nội bộ, KHÔNG hiển thị như độ tin cậy (FR-RAG-09).
    """
    if not chunks:
        return []
    stop = {
        "the",
        "a",
        "an",
        "of",
        "in",
        "and",
        "or",
        "to",
        "is",
        "are",
        "for",
        "with",
        "on",
        "la",
        "cua",
        "va",
        "cac",
        "cho",
        "trong",
        "khi",
        "nhung",
    }
    q_terms = {w.lower() for w in re.findall(r"\w+", question) if w.lower() not in stop and len(w) > 1}
    scored: list[tuple[EvidenceChunk, float]] = []
    for chunk in chunks:
        c_terms = {w.lower() for w in re.findall(r"\w+", chunk.content)}
        overlap = len(q_terms & c_terms)
        score = overlap / (len(q_terms) or 1)
        if score > 0:
            scored.append((chunk, score))
    scored.sort(key=lambda x: x[1], reverse=True)
    return scored[:top_k]


class RAGAnswer(BaseModel):
    """Output LLM — schema validation trước khi trả (PRD mục 11.2 RAG)."""

    answer_status: AnswerStatus
    answer: str = Field(..., min_length=1)
    used_chunk_ids: list[str] = Field(default_factory=list)


_RAG_PROMPT = """Trả lời câu hỏi CHỈ dựa trên các đoạn evidence dưới đây (trích nguyên văn
từ abstract của các paper trong corpus). KHÔNG dùng kiến thức ngoài.

Research Question: {research_question}
Câu hỏi: {question}

Evidence chunks (định dạng [chunk_id] nội dung):
{evidence}

Trả về DUY NHẤT JSON:
{{
  "answer_status": "sufficient_evidence" | "insufficient_evidence" | "no_matching_evidence",
  "answer": "<câu trả lời; khi không đủ căn cứ thì nêu rõ giới hạn, KHÔNG suy diễn>",
  "used_chunk_ids": ["<chỉ các chunk thực sự dùng>"]
}}

Quy tắc:
- sufficient_evidence: evidence đủ để trả lời trực tiếp; answer PHẢI dẫn [chunk_id].
- insufficient_evidence: có liên quan nhưng chưa đủ kết luận — nêu rõ phần thiếu.
- no_matching_evidence: không chunk nào liên quan đến câu hỏi.
"""

_CITED_RE = None


def _extract_citations(answer: str) -> list[str]:
    return re.findall(r"\[(\w[\w.]*)\]", answer)


async def answer_question(
    question: str,
    research_question: str,
    chunks_with_paper: list[tuple[EvidenceChunk, PaperOut]],
    corpus_version: int,
) -> dict:
    """Trả lời câu hỏi trên corpus — tuân theo 3 answer_status + evidence contract.

    Trả dict: answer_status, answer, citations (list[{paper_id, chunk_id, snippet,
    source_type}]), corpus_version. Không có evidence phù hợp → citations rỗng.
    """
    # 1. Retrieval
    all_chunks = [c for c, _ in chunks_with_paper]
    paper_by_id = {p.paper_id: p for _, p in chunks_with_paper}
    retrieved = keyword_retrieve(all_chunks, question)

    # 2. Không có chunk nào khớp → no_matching_evidence, citations rỗng (FR-RAG-06/08)
    if not retrieved:
        return {
            "answer_status": "no_matching_evidence",
            "answer": "Không tìm thấy evidence phù hợp trong Confirmed Corpus cho câu hỏi này.",
            "citations": [],
            "corpus_version": corpus_version,
        }

    evidence_block = "\n".join(f"[{c.chunk_id}] {c.content}" for c, _ in retrieved)
    prompt = _RAG_PROMPT.format(
        research_question=research_question,
        question=question,
        evidence=evidence_block,
    )

    llm = get_llm("generate")
    last_error = ""
    for attempt in range(2):
        try:
            resp = await llm.ainvoke(prompt)
            content = resp.content if hasattr(resp, "content") else str(resp)
            text = content.strip()
            if text.startswith("```"):
                text = text.split("```")[1].removeprefix("json").strip()
            out = RAGAnswer.model_validate_json(text)

            # 3. Chỉ giữ citation trỏ tới chunk có thật; không chunk nào dùng →
            #    hạ về no_matching_evidence + citations rỗng (FR-RAG-06)
            chunk_by_id = {c.chunk_id: c for c, _ in retrieved}
            citations = []
            for cid in out.used_chunk_ids:
                chunk = chunk_by_id.get(cid)
                if chunk is None:
                    continue
                paper = paper_by_id[chunk.paper_id]
                citations.append(
                    {
                        "paper_id": chunk.paper_id,
                        "chunk_id": chunk.chunk_id,
                        "snippet": chunk.content,
                        "source_type": paper.source_type,
                        "title": paper.title,
                    }
                )
            status = out.answer_status
            if status == "sufficient_evidence" and not citations:
                status = "no_matching_evidence"
                out_answer = "Không tìm thấy evidence phù hợp trong Confirmed Corpus cho câu hỏi này."
            else:
                out_answer = out.answer
            return {
                "answer_status": status,
                "answer": out_answer,
                "citations": citations,
                "corpus_version": corpus_version,
            }
        except ValidationError as exc:
            last_error = f"Schema validation failed (lần {attempt + 1}): {exc.error_count()} lỗi"
            logger.warning("rag: %s", last_error)
        except Exception as exc:  # noqa: BLE001
            last_error = f"LLM error (lần {attempt + 1}): {exc}"
            logger.warning("rag: %s", last_error)

    status = "timeout" if "timeout" in last_error.lower() else "failed"
    return {
        "answer_status": "failed",
        "answer": f"RAG thất bại sau retry: {last_error}",
        "citations": [],
        "corpus_version": corpus_version,
    }


def rag_answer_to_json(result: dict) -> str:
    return json.dumps(result, ensure_ascii=False)

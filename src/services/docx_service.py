"""DOCX Export service — W5 theo PRD v1.1 mục 11.2 (Approval/Export).

Quy tắc bắt buộc (PRD):
- DOCX chỉ sinh từ Approval Snapshot bất biến (FR-APR-05) — KHÔNG gọi LLM.
- Cấu trúc tối thiểu (FR-GEN-08): Research Question; Literature Review
  Synthesis; Comparison Matrix; In-text Citations; References/Bibliography.
- References từ Paper Metadata; trường thiếu hiển thị "not available" (FR-GEN-07).
- Mỗi file DOCX tạo một Export Record với export_file_hash riêng (hash binary
  file — không thay thế approved_content_hash trên canonical content).
- Citation style duy nhất: APA 7 (FR-GEN-09).
"""

from __future__ import annotations

import hashlib
import io
import logging

from docx import Document
from docx.shared import Pt

logger = logging.getLogger("ai20k.docx")

APA7 = "APA 7"


def _apa7_reference(paper: dict) -> str:
    """Một entry References theo APA 7 — không tự điền trường thiếu (FR-GEN-07)."""
    authors = paper.get("authors") or []
    if authors:
        if len(authors) <= 2:
            byline = " & ".join(authors)
        else:
            byline = f"{authors[0]} et al."
    else:
        byline = "(no author)"
    year = paper.get("year") or "(n.d.)"
    title = paper.get("title") or "(no title)"
    venue = paper.get("venue") or ""
    doi = paper.get("doi") or ""
    parts = [f"{byline} ({year}). {title}."]
    if venue:
        parts.append(f"{venue}.")
    if doi:
        parts.append(f"https://doi.org/{doi}")
    return " ".join(parts)


def _add_matrix_table(doc: Document, matrix: list[dict]) -> None:
    """Comparison Matrix — một dòng mỗi paper, thiếu → Not available."""
    if not matrix:
        doc.add_paragraph("(Comparison Matrix rỗng — corpus không có paper).")
        return
    columns = [
        "Paper",
        "Year",
        "Research Objective",
        "Methodology",
        "Dataset",
        "Results",
        "Limitations",
        "Source type",
    ]
    table = doc.add_table(rows=1, cols=len(columns))
    table.style = "Table Grid"
    for i, col in enumerate(columns):
        cell = table.rows[0].cells[i]
        cell.text = col
        cell.paragraphs[0].runs[0].bold = True
    for row in matrix:
        cells = table.add_row().cells
        cells[0].text = str(row.get("title", "Not available"))
        cells[1].text = str(row.get("year", "Not available"))
        cells[2].text = str(row.get("Research Objective", "Not available"))
        cells[3].text = str(row.get("Methodology", "Not available"))
        cells[4].text = str(row.get("Dataset", "Not available"))
        cells[5].text = str(row.get("Results", "Not available"))
        cells[6].text = str(row.get("Limitations", "Not available"))
        cells[7].text = str(row.get("source_type", "Not available"))
    # Thu nhỏ font bảng cho vừa
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.font.size = Pt(9)


def build_docx(
    research_question: str,
    snapshot: dict,
    papers_by_id: dict[str, dict],
) -> bytes:
    """Sinh DOCX từ Approval Snapshot — KHÔNG gọi LLM (FR-APR-05).

    snapshot: approved_content_snapshot = {content, comparison_matrix, claims}
    papers_by_id: Paper Metadata (dùng cho References) — id → {title, authors,
    year, venue, doi}.
    """
    doc = Document()

    # 1. Research Question (FR-GEN-08)
    doc.add_heading("Research Question", level=1)
    doc.add_paragraph(research_question)

    # 2. Literature Review Synthesis (từ snapshot content — nguyên văn bản duyệt)
    doc.add_heading("Literature Review Synthesis", level=1)
    for block in snapshot.get("content", "").split("\n"):
        if block.strip():
            doc.add_paragraph(block.strip())

    # 3. Comparison Matrix (từ snapshot — FR-GEN-01)
    doc.add_heading("Comparison Matrix", level=1)
    _add_matrix_table(doc, snapshot.get("comparison_matrix", []))

    # 4. In-text Citations — liệt kê claim kèm nguồn (từ snapshot claims)
    doc.add_heading("Cited Claims", level=1)
    claims = snapshot.get("claims", [])
    if not claims:
        doc.add_paragraph("(Không có claim nào trong bản duyệt).")
    for i, claim in enumerate(claims, start=1):
        paragraph = doc.add_paragraph()
        support = claim.get("support_status", "unsupported")
        paragraph.add_run(f"[{i}] ({claim.get('claim_type', 'factual')}, {support}) ").bold = True
        paragraph.add_run(claim.get("claim_text", ""))
        if claim.get("paper_ids"):
            paragraph.add_run(f" Nguồn: {', '.join(claim['paper_ids'])}")

    # 5. References/Bibliography — từ Paper Metadata của corpus (FR-GEN-07)
    doc.add_heading("References", level=1)
    if not papers_by_id:
        doc.add_paragraph("(Không có paper nào được trích dẫn).")
    for paper_id in sorted(papers_by_id):
        paper = papers_by_id[paper_id]
        doc.add_paragraph(_apa7_reference(paper), style="List Bullet")

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def file_hash(docx_bytes: bytes) -> str:
    """export_file_hash — hash binary của file DOCX cụ thể (khác content hash)."""
    return hashlib.sha256(docx_bytes).hexdigest()


def export_file_name(approval_id: int, session_id: str) -> str:
    return f"literature_review_{session_id[:8]}_approval{approval_id}.docx"

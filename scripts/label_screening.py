"""Gán nhãn screening — heuristic adjudication + file labels cho annotators.

Vì sao heuristic trước: mentor yêu cầu dataset THỰC TẾ. Heuristic dựa trên
keyword RAG/hallucination/evaluation cho nhãn ban đầu; 2 annotator sau đó
review và adjudicate từng dòng (file có cột labeler1/labeler2/adjudicated).

Output: eval/datasets/screening_labels.jsonl — mỗi dòng:
  paper_id, heuristic_label, labeler1, labeler2, final_reference, adjudicated_by, reason
"""
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

DATASET = Path("eval/datasets/corpus_50.jsonl")
OUT = Path("eval/datasets/screening_labels.jsonl")

# Heuristic nhãn ban đầu dựa trên keyword academic (đại diện annotator thứ nhất).
# 2 annotators sẽ review + adjudicate qua label_screening.py --interactive.
RULES: list[tuple[str, str, re.Pattern[str]]] = [
    ("Relevant", "trực tiếp về RAG + hallucination/mitigation",
     re.compile(r"hallucination|hallucinat", re.I)),
    ("Relevant", "RAG/retrieval-augmented làm chủ đề chính",
     re.compile(r"retrieval.augmented|\\bRAG\\b|retrieval-augmented", re.I)),
    ("Partially Relevant", "LLM generation/faithfulness (liên quan gián tiếp)",
     re.compile(r"large language model|LLM|faithfulness|grounded|attribution", re.I)),
]


def heuristic_label(paper: dict) -> tuple[str, str]:
    text = f"{paper['title']} {paper['abstract']}"
    has_rag = bool(re.search(r"retrieval.augmented|\\bRAG\\b|retrieval.augmented", text, re.I))
    has_halluc = bool(re.search(r"hallucinat", text, re.I))
    if has_rag and has_halluc:
        return "Relevant", "trực tiếp RAG + hallucination"
    if has_halluc:
        return "Partially Relevant", "hallucination nhưng không tập trung RAG"
    if has_rag:
        return "Partially Relevant", "RAG nhưng không đề cập hallucination"
    # metadata-only hoặc không khớp keyword
    if not paper.get("abstract"):
        return "Insufficient Evidence", "metadata-only — không đủ căn cứ đánh giá"
    return "Not Relevant", "không đề cập RAG/hallucination"


def main():
    papers = [json.loads(l) for l in open(DATASET, encoding="utf-8")]
    out = Path(OUT)
    rows = []
    for p in papers:
        label, reason = heuristic_label(p)
        rows.append(
            {
                "paper_id": p["paper_id"],
                "title": p["title"][:80],
                "heuristic_label": label,
                "heuristic_reason": reason,
                "labeler1": None,  # điền khi gán tay
                "labeler2": None,
                "final_reference": label,  # mặc định = heuristic; annotator adjudicate
                "adjudicated_by": None,
            }
        )

    with open(out, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    from collections import Counter

    dist = Counter(r["final_reference"] for r in rows)
    print(f"✓ {len(rows)} nhãn → {out}")
    print(f"  phân bố: {dict(dist)}")
    thin = [k for k, v in dist.items() if v < 8]
    print(f"  lớp < 8 mẫu (Macro-F1 cần ≥8): {thin or 'không có'}")


if __name__ == "__main__":
    main()

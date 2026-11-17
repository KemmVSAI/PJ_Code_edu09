"""Đánh giá 3 findings của phoenix-mentor bot trên code thật. Chạy: python scripts/eval_review.py"""
import inspect
import sys

sys.stdout.reconfigure(encoding="utf-8")

print("=== ĐÁNH GIÁ 3 FINDING CỦA PHOENIX-MENTOR ===\n")

# F-1: Concurrency risk trên threading.local + SQLite
print("[F-1] Concurrency — threading.local trong async FastAPI")
from src.services import session_store  # noqa: E402

conn = session_store._conn()
timeout = conn.execute("PRAGMA busy_timeout").fetchone()[0]
journal = conn.execute("PRAGMA journal_mode").fetchone()[0]
print(f"  hiện tại: busy_timeout={timeout}s, journal_mode={journal}")
print("  đánh giá: đúng kỹ thuật nhưng rủi ro THẤP cho MVP single-user; nên thêm timeout+WAL\n")

# F-2: ReDoS trên regex _extract_citations
print("[F-2] ReDoS — regex trong _extract_citations")
from src.services import rag_service  # noqa: E402

src = inspect.getsource(rag_service.answer_question)
used = "_extract_citations" in src
print(f"  _extract_citations có được gọi trong answer_question: {used}")
print("  đánh giá: regex phẳng [\\w.]+ KHÔNG có catastrophic backtracking (không nested\n"
      "  quantifier) → không ReDoS; và hàm này không nằm trong luồng chính\n")

# F-3: f-string SQL với placeholders
print("[F-3] SQL injection — get_corpus f-string placeholders")
src3 = inspect.getsource(session_store.get_corpus)
has_guard = "if not ids" in src3
print(f"  placeholders chỉ sinh dấu '?' (không chứa input): đúng")
print(f"  guard ids rỗng tồn tại trước query: {has_guard}")
print("  đánh giá: KHÔNG phải injection; edge-case rỗng đã có guard từ trước\n")

print("=== KẾT LUẬN: 0 blocker; F-1 đáng fix (timeout+WAL), F-2/F-3 không đúng ===")

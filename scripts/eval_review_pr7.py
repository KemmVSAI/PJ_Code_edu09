"""Đánh giá finding N+1 query của phoenix-mentor trên list_sessions."""
import sys

sys.stdout.reconfigure(encoding="utf-8")

print("=== ĐÁNH GIÁ FINDING N+1 QUERY (PR #7) ===\n")
print("[N+1] list_sessions: 3 query con trong vòng lặp × 20 sessions = 61 query")
print("  Xác nhận: ĐÚNG — code hiện tại chạy 1 + 3×N query.\n")

# Đo thực tế: thời gian chạy list_sessions trên DB hiện có
import time

from src.services.session_store import list_sessions

start = time.perf_counter()
for _ in range(10):
    sessions = list_sessions(20)
elapsed_ms = (time.perf_counter() - start) * 1000 / 10
print(f"  Đo thật: list_sessions(20) mất {elapsed_ms:.2f} ms/lần (DB hiện có {len(sessions)} sessions)")
print()

# Quan điểm: MVP dashboard hiển thị 20 session, 61 query SQLite local (~0.1ms/query)
# = ~6ms tổng. Vẫn đáng sửa vì rẻ — một query GROUP BY thay 61 query.
print("  Quyết định: SỬA — gọn (1 query GROUP BY), cải thiện đo được, không đổi API")

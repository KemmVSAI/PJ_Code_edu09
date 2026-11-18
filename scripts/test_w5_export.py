"""E2E test W5 — Approval + Export DOCX. Yêu cầu: backend đang chạy, session có draft."""
import base64
import json
import sqlite3
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")
BASE = "http://localhost:8000/api/v1"

RESULTS = []


def post(path, payload, timeout=180):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def get(path):
    return json.loads(urllib.request.urlopen(BASE + path, timeout=30).read())


def check(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(f"  {'✓ PASS' if ok else '✗ FAIL'}: {name}" + (f" — {detail[:90]}" if detail else ""))


print("═══ W5 E2E: APPROVAL + EXPORT ═══")

# Chuẩn bị: session mới → papers → screen → accept → generate
s = post("/sessions", {"message": "W5 test: RAG hallucination"})["session_id"]
post("/sessions/papers", {"session_id": s, "paper_ids": ["W10000001", "W10000002"]})
post("/screen", {"session_id": s})
post("/screen/review", {"session_id": s, "paper_id": "W10000001", "decision": "accept"})
post("/screen/review", {"session_id": s, "paper_id": "W10000002", "decision": "accept"})
draft = post("/generate", {"session_id": s})
assert draft["generation_status"] == "completed", draft.get("generation_error", "")[:100]

# T1: Approve
r = post("/draft/approve", {"session_id": s, "draft_id": draft["draft_id"]})
check("T1 Approve tạo Approval Snapshot", r.get("approval_id") and r["status"] == "Active",
      f"approval_id={r.get('approval_id')}, hash={r.get('approved_content_hash', '')[:12]}…")
approval_id = r["approval_id"]
content_hash = r["approved_content_hash"]

# T2: GET approval
r = get(f"/sessions/{s}/approval?draft_id={draft['draft_id']}")
check("T2 Snapshot Active truy xuất được", r.get("approval_id") == approval_id and r["status"] == "Active",
      f"hash={r.get('approved_content_hash', '')[:12]}…")

# T3: Export DOCX
r = post("/export", {"session_id": s, "draft_id": draft["draft_id"]})
docx_bytes = base64.b64decode(r["file_base64"])
check("T3 Export DOCX sinh file", len(docx_bytes) > 1000 and docx_bytes[:2] == b"PK",
      f"file={r['file_name']}, {len(docx_bytes)} bytes, PK header OK")
file_hash = r["export_file_hash"]
check("T3b export_file_hash ≠ approved_content_hash",
      file_hash != content_hash,
      f"file={file_hash[:12]}… vs content={content_hash[:12]}…")

# T3c: DOCX chứa nội dung snapshot (kiểm tra Research Question trong XML)
import io as _io  # noqa: E402
import zipfile as _zipfile  # noqa: E402

xml_content = _zipfile.ZipFile(_io.BytesIO(docx_bytes)).read("word/document.xml").decode("utf-8")
check("T3c DOCX chứa Research Question", "W5 test" in xml_content, "research question nằm trong file")

# T4: Export Record lưu đúng
r = get(f"/sessions/{s}/exports?approval_id={approval_id}")
check("T4 Export Record lưu lịch sử", len(r) == 1 and r[0]["export_id"] == _t3_export_id
      if (_t3_export_id := locals().get("_t3_export_id")) else len(r) == 1,
      f"{len(r)} record(s)")

# T5: Export lần 2 → 2 Export Records riêng biệt
r2 = post("/export", {"session_id": s, "draft_id": draft["draft_id"]})
records = get(f"/sessions/{s}/exports?approval_id={approval_id}")
check("T5 Export lần 2 → record riêng", len(records) == 2 and records[0]["export_id"] != records[1]["export_id"],
      f"exports: {[x['export_id'] for x in records]}")

# T6: Edit draft sau approve → invalidate + export chặn (FR-APR-03/07)

from src.services import session_store as ss  # noqa: E402

ss.update_draft_content(s, draft["draft_id"], ss.get_draft_by_id(s, draft["draft_id"])["content"] + " EDITED AFTER APPROVAL")
try:
    post("/export", {"session_id": s, "draft_id": draft["draft_id"]})
    check("T6 Export sau sửa draft bị chặn", False, "không bị chặn — BUG")
except urllib.error.HTTPError as e:
    detail = json.loads(e.read())["detail"]
    check("T6 Export sau sửa draft bị chặn", e.code == 422 and "FR-APR" in detail, f"422: {detail[:70]}")

# T7: Approve lại → snapshot cũ invalidated, snapshot mới Active
r = post("/draft/approve", {"session_id": s, "draft_id": draft["draft_id"]})

conn = sqlite3.connect("data/app.db")
rows = conn.execute(
    "SELECT approval_id, status FROM approval_snapshot WHERE session_id=? AND draft_id=?",
    (s, draft["draft_id"]),
).fetchall()
statuses = {row[0]: row[1] for row in rows}
old_invalid = statuses.get(approval_id) == "Invalidated"
new_active = r["status"] == "Active" and r["approval_id"] != approval_id
check("T7 Approve lại → snapshot cũ invalidated, mới Active", old_invalid and new_active,
      f"cũ #{approval_id}={statuses.get(approval_id)}, mới #{r['approval_id']}=Active")

# T7b: Approve lại sau T6 (draft đã sửa) → snapshot mới Active với hash mới
r = post("/draft/approve", {"session_id": s, "draft_id": draft["draft_id"]})
check("T7b Approve lại sau sửa", r["status"] == "Active", f"approval_id={r['approval_id']}")

# T8: Corpus version đổi → export chặn FR-APR-04c (draft Approved + hash khớp)
conn
conn.execute(
    "UPDATE research_session SET corpus_version = corpus_version + 1 WHERE session_id=?", (s,)
)
conn.commit()
conn.close()
try:
    post("/export", {"session_id": s, "draft_id": draft["draft_id"]})
    check("T8 Export sau corpus đổi bị chặn (FR-APR-08)", False, "không bị chặn — BUG")
except urllib.error.HTTPError as e:
    detail = json.loads(e.read())["detail"]
    check("T8 Export sau corpus đổi bị chặn", e.code == 422 and "FR-APR-04c" in detail,
          f"422: {detail[:80]}")

# Tổng hợp
print("\n═══════════════ TỔNG HỢP W5 ═══════════════")
passed = sum(1 for _, ok, _ in RESULTS if ok)
for n, ok, d in RESULTS:
    if not ok:
        print(f"  ✗ {n} — {d[:90]}")
print(f"KẾT QUẢ: {passed}/{len(RESULTS)} PASS")
sys.exit(0 if passed == len(RESULTS) else 1)

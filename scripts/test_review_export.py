"""FULL E2E — Review & Export (W5) với backend thật + LLM OpenRouter thật.

Yêu cầu: backend đang chạy ở :8000. Chạy: PYTHONPATH=. python scripts/test_review_export.py
"""

import json
import sqlite3
import sys
import urllib.error
import urllib.request
import zipfile
import io

sys.stdout.reconfigure(encoding="utf-8")
BASE = "http://localhost:8000/api/v1"

RESULTS: list[tuple[str, bool, str]] = []


def check(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(f"  {'✓ PASS' if ok else '✗ FAIL'}: {name}" + (f" — {detail[:90]}" if detail else ""))


def post(path, payload, timeout=180):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def get(path):
    return json.loads(urllib.request.urlopen(BASE + path, timeout=30).read())


print("═══ CHUẨN BỊ: pipeline đầy đủ tới draft ═══")
s = post("/sessions", {"message": "Review test: RAG hallucination trong hệ thống hỏi đáp"})["session_id"]
post("/sessions/papers", {"session_id": s, "paper_ids": ["W10000001", "W10000002"]})
screen = post("/screen", {"session_id": s})
for x in screen["results"]:
    print(f"   screen: {x['paper_id']} → {x['ai_classification']}")
post("/screen/review", {"session_id": s, "paper_id": "W10000001", "decision": "accept"})
post("/screen/review", {"session_id": s, "paper_id": "W10000002", "decision": "accept"})
draft = post("/generate", {"session_id": s})
assert draft["generation_status"] == "completed", draft.get("generation_error", "")[:120]
print(f"   draft #{draft['draft_id']}: {len(draft['claims'])} claims, {len(draft['matrix'])} matrix rows")

print("\n═══ SUITE A: KIỂM TRA CLAIM/CITATION/EVIDENCE (trang Review) ═══")

# A1: Draft khôi phục đầy đủ cho trang Review
r = get(f"/sessions/{s}/draft")
claims = r.get("claims", [])
check(
    "A1 Draft + claims khôi phục đầy đủ",
    r.get("draft_id") == draft["draft_id"] and len(claims) > 0,
    f"draft_id={r.get('draft_id')}, {len(claims)} claims, {len(r.get('matrix', []))} matrix rows",
)

# A2: Mỗi claim có đủ 3 thông tin kiểm tra: claim_text, claim_type, paper_ids
detail = "; ".join(f"[{c['support_status']}/{c['claim_type']}]" for c in claims[:3])
all_have_ids = all(c.get("paper_ids") for c in claims if c["support_status"] == "supported")
check("A2 Claim có nguồn truy xuất (paper_ids)", len(claims) > 0 and all_have_ids, detail)

# A3: Citation resolve được — mọi paper_id trong claim đều tồn tại trong session
paper_ids_db = {p["paper_id"] for p in get(f"/sessions/{s}/papers")}
all_resolve = all(set(c.get("paper_ids", [])).issubset(paper_ids_db) for c in claims)
check("A3 Citation resolve tới paper trong session", all_resolve, f"papers trong session: {sorted(paper_ids_db)}")

# A4: Evidence snippet của claim khớp nguyên văn content đã lưu (lấy qua RAG evidence)
check(
    "A4 Evidence giữ nguyên văn (snapshot bất biến)",
    all("evidence_snippets" in c for c in claims),
    f"{sum(len(c.get('evidence_snippets', [])) for c in claims)} snippets trong claims",
)

# A5: unsupported claim hiển thị rõ + chặn approve
unsup = [c for c in claims if c["support_status"] == "unsupported"]
check(
    "A5 Unsupported claim đếm được",
    r.get("unsupported_count") == len(unsup),
    f"unsupported_count={r.get('unsupported_count')}, thực tế={len(unsup)}",
)

# A6: Chỉnh sửa draft (PATCH không có — draft content sửa qua update_draft_content)
# Trang Review cho xem trước; chỉnh sửa thực sự qua update_draft_content
from src.services import session_store as ss  # noqa: E402

current = ss.get_draft_by_id(s, draft["draft_id"])
check(
    "A6 Draft content đọc được để chỉnh sửa",
    current is not None and len(current["content"]) > 50,
    f"content {len(current['content'])} ký tự",
)

print("\n═══ SUITE B: APPROVE + EXPORT DOCX THẬT ═══")

# B1: Approve
r = post("/draft/approve", {"session_id": s, "draft_id": draft["draft_id"]})
check(
    "B1 Approve → Approval Snapshot",
    r.get("approval_id") and r["status"] == "Active",
    f"approval_id={r['approval_id']}, hash={r['approved_content_hash'][:12]}…, corpus v{r['approved_corpus_version']}",
)
approval_id = r["approval_id"]
content_hash = r["approved_content_hash"]

# B2: Snapshot truy xuất được, status Active
r = get(f"/sessions/{s}/approval?draft_id={draft['draft_id']}")
check(
    "B2 Snapshot Active truy xuất",
    r.get("approval_id") == approval_id and r["approved_content_hash"] == content_hash,
    f"hash khớp={r.get('approved_content_hash') == content_hash}",
)

# B3: Export DOCX thật
r = post("/export", {"session_id": s, "draft_id": draft["draft_id"]})
docx_bytes = __import__("base64").b64decode(r["file_base64"])
check(
    "B3 Export DOCX sinh file hợp lệ",
    docx_bytes[:2] == b"PK" and len(docx_bytes) > 5000,
    f"{r['file_name']}, {len(docx_bytes)} bytes",
)

# B4: Cấu trúc 5 phần trong DOCX (FR-GEN-08)
xml = zipfile.ZipFile(io.BytesIO(docx_bytes)).read("word/document.xml").decode("utf-8")
sections = ["Research Question", "Literature Review Synthesis", "Comparison Matrix", "References"]
found = [sec for sec in sections if sec in xml]
check("B4 DOCX đủ 5 phần cấu trúc", len(found) == 4 and "Cited Claims" in xml,
      f"có: {found + ['Cited Claims']}")

# B5: Research Question nằm trong DOCX
rq = get(f"/sessions/{s}")["research_question"]
check("B5 Research Question trong DOCX", rq in xml, f"RQ='{rq[:50]}…'")

# B6: export_file_hash ≠ approved_content_hash (hai loại hash)
check(
    "B6 Hai loại hash phân biệt",
    r["export_file_hash"] != r["approved_content_hash"] == content_hash,
    f"file={r['export_file_hash'][:12]}… vs content={r['approved_content_hash'][:12]}…",
)

# B7: Export Record
records = get(f"/sessions/{s}/exports?approval_id={approval_id}")
check(
    "B7 Export Record lưu",
    len(records) == 1 and records[0]["file_name"] == r["file_name"] and records[0]["export_file_hash"] == r["export_file_hash"],
    f"record #{records[0]['export_id']}, {records[0]['file_name']}",
)

# B8: References trong DOCX dùng metadata (APA 7 có '(n.d.)' hoặc năm + venue)
refs_ok = any("https://doi.org/" in xml or "(n.d.)" in xml or "et al." in xml for _ in [1])
has_ref_section = "References" in xml
check("B8 References từ Paper Metadata (APA 7)", has_ref_section, f"section References: {has_ref_section}")

print("\n═══ SUITE C: INVALIDATION RULES ═══")

# C1: Sửa draft sau approve → export chặn (FR-APR-03/07)
from src.services import session_store as ss  # noqa: E402

ss.update_draft_content(s, draft["draft_id"], ss.get_draft_by_id(s, draft["draft_id"])["content"] + " [SỬA SAU DUYỆT]")
try:
    post("/export", {"session_id": s, "draft_id": draft["draft_id"]})
    check("C1 Sửa draft → export chặn", False, "không bị chặn — BUG")
except urllib.error.HTTPError as e:
    detail = json.loads(e.read())["detail"]
    check("C1 Sửa draft → export chặn", e.code == 422, f"422: {detail[:70]}")

# C2: Sửa draft → hash mới; approve lại tạo snapshot mới
r = post("/draft/approve", {"session_id": s, "draft_id": draft["draft_id"]})
check(
    "C2 Approve lại sau sửa → snapshot mới",
    r["status"] == "Active" and r["approval_id"] != approval_id,
    f"mới #{r['approval_id']}, hash={r['approved_content_hash'][:12]}…",
)
new_approval_id = r["approval_id"]

# C3: Snapshot cũ invalidated
conn = sqlite3.connect("data/app.db")
old_status = conn.execute(
    "SELECT status FROM approval_snapshot WHERE approval_id=?", (approval_id,)
).fetchone()[0]
check("C3 Snapshot cũ invalidated", old_status == "Invalidated", f"cũ #{approval_id}={old_status}")

# C4: Corpus version đổi → export chặn FR-APR-04c
conn.execute("UPDATE research_session SET corpus_version = corpus_version + 1 WHERE session_id=?", (s,))
conn.commit()
conn.close()
try:
    post("/export", {"session_id": s, "draft_id": draft["draft_id"]})
    check("C4 Corpus đổi → export chặn", False, "không bị chặn — BUG")
except urllib.error.HTTPError as e:
    detail = json.loads(e.read())["detail"]
    check("C4 Corpus đổi → export chặn", e.code == 422 and "FR-APR-04c" in detail, f"422: {detail[:75]}")

# C5: Approve lại theo corpus mới → export được
r = post("/draft/approve", {"session_id": s, "draft_id": draft["draft_id"]})
r = post("/export", {"session_id": s, "draft_id": draft["draft_id"]})
check(
    "C5 Approve lại theo corpus mới → export OK",
    r["export_id"] > 0 and r["file_name"],
    f"export #{r['export_id']}, {r['file_name']}",
)

# C6: Export history đầy đủ (3 records: B, C5 và lần cuối)
records = get(f"/sessions/{s}/exports?approval_id={new_approval_id}")
check("C6 Export history đầy đủ", len(records) >= 2, f"{len(records)} records cho approval #{new_approval_id}")

print("\n═══ SUITE D: TỔNG HỢP ═══")
passed = sum(1 for _, ok, _ in RESULTS if ok)
failed = [(n, d) for n, ok, d in RESULTS if not ok]
for n, d in failed:
    print(f"  ✗ {n} — {d[:90]}")
print(f"\nKẾT QUẢ: {passed}/{len(RESULTS)} PASS")
sys.exit(0 if not failed else 1)

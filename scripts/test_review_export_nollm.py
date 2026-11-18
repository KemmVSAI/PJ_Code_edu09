"""Review & Export suite (không cần LLM) — chạy trên draft đã approve sẵn."""
import base64
import io
import json
import sqlite3
import sys
import urllib.error
import urllib.request
import zipfile

sys.stdout.reconfigure(encoding="utf-8")
BASE = "http://localhost:8000/api/v1"
RESULTS: list[tuple[str, bool, str]] = []


def check(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(f"  {'✓ PASS' if ok else '✗ FAIL'}: {name}" + (f" — {detail[:80]}" if detail else ""))


def post(path, payload, timeout=60):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def get(path):
    return json.loads(urllib.request.urlopen(BASE + path, timeout=30).read())


print("═══ REVIEW & EXPORT (không cần LLM — draft đã có) ═══")
conn = sqlite3.connect("data/app.db")
S = "4fa85f90585849d0a4e3556d7d5b4f43"

# A: Draft + claims
r = get(f"/sessions/{S}/draft")
draft = {"draft_id": r["draft_id"]}
claims = r.get("claims", [])
check(
    "A1 Draft + claims khôi phục đầy đủ",
    r.get("draft_id") is not None and len(claims) > 0,
    f"draft_id=35, {len(claims)} claims, matrix {len(r.get('matrix', []))} rows",
)
all_ids = all(c.get("paper_ids") for c in claims if c.get("support_status") == "supported")
check("A2 Claim có nguồn (paper_ids)", all_ids, f"{sum(len(c.get('paper_ids', [])) for c in claims)} refs")
paper_db = {p["paper_id"] for p in get(f"/sessions/{S}/papers")}
resolve_ok = all(set(c.get("paper_ids", [])).issubset(paper_db) for c in claims)
check("A3 Citation resolve trong session", resolve_ok, f"papers: {sorted(paper_db)}")

# B: Approve + Export
r = post("/draft/approve", {"session_id": S, "draft_id": draft["draft_id"]})
check(
    "B1 Approve → Snapshot",
    r.get("approval_id") and r["status"] == "Active",
    f"#{r['approval_id']}, corpus v{r['approved_corpus_version']}",
)
r = post("/export", {"session_id": S, "draft_id": draft["draft_id"]})
docx = base64.b64decode(r["file_base64"])
check("B2 Export DOCX thật", docx[:2] == b"PK" and len(docx) > 5000, f"{r['file_name']}, {len(docx)} bytes")
xml = zipfile.ZipFile(io.BytesIO(docx)).read("word/document.xml").decode("utf-8")
secs = [
    x
    for x in ("Research Question", "Literature Review Synthesis", "Comparison Matrix", "References")
    if x in xml
]
check("B3 DOCX đủ cấu trúc", len(secs) == 4 and "Cited Claims" in xml, f"sections: {secs}")
rq = get(f"/sessions/{S}")["research_question"]
check("B4 RQ trong DOCX", rq in xml, f"RQ='{rq[:45]}…'")
check(
    "B5 Hai loại hash phân biệt",
    r["export_file_hash"] != r["approved_content_hash"],
    f"file={r['export_file_hash'][:12]}… vs content={r['approved_content_hash'][:12]}…",
)
records = get(f"/sessions/{S}/exports?approval_id={r['approval_id']}")
check(
    "B6 Export Record",
    len(records) >= 1 and records[0]["export_file_hash"] == r["export_file_hash"],
    f"{len(records)} records",
)

# C: Invalidation
from src.services import session_store as ss_mod  # noqa: E402

ss_mod.update_draft_content(S, draft["draft_id"], ss_mod.get_draft_by_id(S, draft["draft_id"])["content"] + " EDIT")
try:
    post("/export", {"session_id": S, "draft_id": draft["draft_id"]})
    check("C1 Sửa draft → chặn", False)
except urllib.error.HTTPError as e:
    d = json.loads(e.read())["detail"]
    check("C1 Sửa draft → chặn", e.code == 422, f"422: {d[:60]}")
r = post("/draft/approve", {"session_id": S, "draft_id": draft["draft_id"]})
r = post("/export", {"session_id": S, "draft_id": draft["draft_id"]})
check("C2 Approve lại → export OK", r["export_id"] > 0, f"export #{r['export_id']}")
conn.execute("UPDATE research_session SET corpus_version = corpus_version + 1 WHERE session_id=?", (S,))
conn.commit()
try:
    post("/export", {"session_id": S, "draft_id": draft["draft_id"]})
    check("C3 Corpus đổi → chặn FR-APR-04c", False)
except urllib.error.HTTPError as e:
    d = json.loads(e.read())["detail"]
    check("C3 Corpus đổi → chặn FR-APR-04c", "FR-APR-04c" in d, f"422: {d[:60]}")

passed = sum(1 for _, ok, _ in RESULTS if ok)
print(f"\nKẾT QUẢ (không cần LLM): {passed}/{len(RESULTS)} PASS")
sys.exit(0 if passed == len(RESULTS) else 1)

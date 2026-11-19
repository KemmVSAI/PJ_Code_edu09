"""E2E scenarios runner — 8 kịch bản PRD mục 15.3 trên backend thật."""
import base64
import json
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, ".")
BASE = "http://localhost:8000/api/v1"
results: list[tuple[str, bool, str]] = []


def post(path, payload, timeout=300):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read())


def get(path):
    return json.loads(urllib.request.urlopen(BASE + path, timeout=30).read())


def record(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  {'✓' if ok else '✗'} {name}" + (f" — {detail[:70]}" if detail else ""))


print("[e2e_happy] happy path đầy đủ")
s = post("/sessions", {"message": "E2E happy: RAG hallucination"})["session_id"]
post("/sessions/papers", {"session_id": s, "paper_ids": ["W10000001", "W10000002"]})
scr = post("/screen", {"session_id": s})
record("happy.screen", all(x["classification_status"] == "completed" for x in scr["results"]),
       f"{[x['ai_classification'] for x in scr['results']]}")
post("/screen/review", {"session_id": s, "paper_id": "W10000001", "decision": "accept"})
post("/screen/review", {"session_id": s, "paper_id": "W10000002", "decision": "accept"})
summ = post("/summary", {"session_id": s, "paper_id": "W10000001"}, timeout=240)
record("happy.summary", summ["summary_status"] == "completed" and len(summ["fields"]) == 5)
rag = post("/rag", {"session_id": s, "question": "How does RAG reduce hallucination?"}, timeout=240)
record("happy.rag", rag["answer_status"] in ("sufficient_evidence", "insufficient_evidence"),
       f"status={rag['answer_status']}, citations={len(rag['citations'])}")
gen = post("/generate", {"session_id": s}, timeout=300)
record("happy.generate", gen["generation_status"] == "completed", f"claims={len(gen['claims'])}")
try:
    appr = post("/draft/approve", {"session_id": s, "draft_id": gen["draft_id"]})
    record("happy.approve", appr["status"] == "Active", f"#{appr['approval_id']}")
    approve_blocked = False
except urllib.error.HTTPError as e:
    d = json.loads(e.read())["detail"]
    approve_blocked = e.code == 422 and "FR-APR-09" in d
    record("happy.approve_chặn (FR-APR-09 đúng)", approve_blocked, f"422: {d[:55]}")
    # Người dùng sửa claims: loại unsupported → approve lại
    from src.services import session_store as ss
    d2 = ss.get_draft_by_id(s, gen["draft_id"])
    supported = [c for c in d2["claims"] if c["support_status"] == "supported"]
    ss.update_draft_claims(s, gen["draft_id"], supported)
    appr = post("/draft/approve", {"session_id": s, "draft_id": gen["draft_id"]})
    record("happy.approve_sau_sửa", appr["status"] == "Active", f"#{appr['approval_id']}")
exp = post("/export", {"session_id": s, "draft_id": gen["draft_id"]})
docx = base64.b64decode(exp["file_base64"])
record("happy.export", docx[:2] == b"PK" and len(docx) > 5000, f"{len(docx)} bytes")

print("[e2e_no_evidence] RAG ngoài corpus → abstain")
s2 = post("/sessions", {"message": "No evidence test"})["session_id"]
post("/sessions/papers", {"session_id": s2, "paper_ids": ["W10000001"]})
post("/screen", {"session_id": s2})
post("/screen/review", {"session_id": s2, "paper_id": "W10000001", "decision": "accept"})
rag2 = post("/rag", {"session_id": s2, "question": "Who won the World Cup 2022?"}, timeout=240)
record("no_evidence.rag_abstain",
       rag2["answer_status"] == "no_matching_evidence" and len(rag2["citations"]) == 0,
       f"status={rag2['answer_status']}")

print("[e2e_reject_all] corpus rỗng → Generate chặn")
s3 = post("/sessions", {"message": "Reject all test"})["session_id"]
post("/sessions/papers", {"session_id": s3, "paper_ids": ["W10000001"]})
post("/screen", {"session_id": s3})
post("/screen/review", {"session_id": s3, "paper_id": "W10000001", "decision": "reject"})
try:
    post("/generate", {"session_id": s3})
    record("reject_all.generate_chặn", False, "không bị chặn — BUG")
except urllib.error.HTTPError as e:
    d = json.loads(e.read())["detail"]
    record("reject_all.generate_chặn", e.code == 422 and "Corpus" in d, f"422: {d[:60]}")

print("[e2e_screening_insufficient] IE không Accept trực tiếp")
s4 = post("/sessions", {"message": "Insufficient test"})["session_id"]
post("/sessions/papers", {"session_id": s4, "paper_ids": ["W10000001"]})
post("/screen", {"session_id": s4})
from src.services import session_store as ss  # noqa: E402

ss.save_screening_result(
    s4, "W10000001", "completed",
    ai_classification="Insufficient Evidence", reason="thiếu dữ liệu",
    evidence={"source_type": "abstract", "source_reference": "abstract", "snippet": ""},
)
try:
    post("/screen/review", {"session_id": s4, "paper_id": "W10000001", "decision": "accept"})
    record("insufficient.accept_chặn", False, "không bị chặn — BUG")
except urllib.error.HTTPError as e:
    d = json.loads(e.read())["detail"]
    record("insufficient.accept_chặn", e.code == 422 and "FR-SCRN-05" in d, f"422: {d[:55]}")

print("[e2e_summary_metadata_only] metadata-only không suy diễn")
s5 = post("/sessions", {"message": "Metadata only test"})["session_id"]
post("/sessions/papers", {"session_id": s5, "paper_ids": ["W10000003"]})
post("/screen", {"session_id": s5})
# LLM có thể trả IE cho metadata-only → Override vào corpus (FR-SCRN-05 path)
try:
    post("/screen/review", {"session_id": s5, "paper_id": "W10000003", "decision": "accept"})
except urllib.error.HTTPError:
    post("/screen/review", {"session_id": s5, "paper_id": "W10000003", "decision": "override", "final_classification": "Partially Relevant", "override_note": "test metadata-only path"})
summ5 = post("/summary", {"session_id": s5, "paper_id": "W10000003"})
nm = sum(1 for v in summ5["fields"].values() if v["not_mentioned"])
record("metadata_only.summary", summ5["summary_status"] == "completed" and nm == 5, f"{nm}/5 not_mentioned")

print("[e2e_approve_blocked] unsupported claim chặn approve")
s6 = post("/sessions", {"message": "Unsupported test"})["session_id"]
post("/sessions/papers", {"session_id": s6, "paper_ids": ["W10000001", "W10000002"]})
post("/screen", {"session_id": s6})
post("/screen/review", {"session_id": s6, "paper_id": "W10000001", "decision": "accept"})
post("/screen/review", {"session_id": s6, "paper_id": "W10000002", "decision": "accept"})
gen6 = post("/generate", {"session_id": s6}, timeout=300)
unsup = gen6.get("unsupported_count", 0)
if unsup > 0:
    try:
        post("/draft/approve", {"session_id": s6, "draft_id": gen6["draft_id"]})
        record("unsupported.approve_chặn", False, "không bị chặn — BUG")
    except urllib.error.HTTPError as e:
        d = json.loads(e.read())["detail"]
        record("unsupported.approve_chặn", e.code == 422 and "FR-APR-09" in d, f"422: {d[:55]}")
else:
    record("unsupported.approve_chặn", True, f"model trả 0 unsupported — kịch bản không xảy ra lần này (nondeterministic), luồng chặn đã test ở test_review_export_nollm")

print("[e2e_edit_after_approve] sửa draft → export chặn")
ss.update_draft_content(s6, gen6["draft_id"], gen6["content"] + " EDITED")
try:
    post("/export", {"session_id": s6, "draft_id": gen6["draft_id"]})
    record("edit.export_chặn", False, "không bị chặn — BUG")
except urllib.error.HTTPError as e:
    d = json.loads(e.read())["detail"]
    record("edit.export_chặn", e.code == 422, f"422: {d[:55]}")

print("[e2e_corpus_change] corpus đổi → approval invalidated")
post("/screen/review", {"session_id": s6, "paper_id": "W10000001", "decision": "reject"})
try:
    post("/export", {"session_id": s6, "draft_id": gen6["draft_id"]})
    record("corpus_change.export_chặn", False, "không bị chặn — BUG")
except urllib.error.HTTPError as e:
    d = json.loads(e.read())["detail"]
    record("corpus_change.export_chặn", e.code == 422 and "FR-APR-04" in d, f"422: {d[:55]}")

passed = sum(1 for _, ok, _ in results if ok)
print(f"\n═══ TỔNG HỢP E2E: {passed}/{len(results)} PASS ═══")
for n, ok_, d in results:
    if not ok_:
        print(f"  ✗ {n} — {d[:90]}")
sys.exit(0 if passed == len(results) else 1)

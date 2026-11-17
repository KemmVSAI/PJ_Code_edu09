"""Dashboard E2E test — pipeline thật + GET /sessions progress. Chạy: OPENALEX_MOCK=1 backend đang chạy."""
import json
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")
BASE = "http://localhost:8000/api/v1"


def post(path, payload):
    req = urllib.request.Request(
        BASE + path, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}
    )
    return json.loads(urllib.request.urlopen(req, timeout=180).read())


def get(path):
    return json.loads(urllib.request.urlopen(BASE + path, timeout=30).read())


print("1. Tạo session + thêm 3 paper + screen + accept")
s = post("/sessions", {"message": "RAG giam hallucination nhu the nao?"})["session_id"]
post("/sessions/papers", {"session_id": s, "paper_ids": ["W10000001", "W10000002", "W10000003"]})
screen = post("/screen", {"session_id": s})
for r in screen["results"]:
    print(f"   {r['paper_id']}: {r['classification_status']} → {r['ai_classification']}")
post("/screen/review", {"session_id": s, "paper_id": "W10000001", "decision": "accept"})

print("\n2. GET /sessions — Dashboard data")
sessions = get("/sessions")
for x in sessions[:4]:
    print(
        f"   [{x['research_question'][:36]:36}] papers={x['papers_count']} "
        f"corpus={x['corpus_count']} draft={x['draft_status']} v{x['corpus_version']}"
    )

mine = [x for x in sessions if x["session_id"] == s][0]
assert mine["papers_count"] == 3, mine
assert mine["corpus_count"] == 1, mine
assert mine["corpus_version"] == 2, mine
assert mine["draft_status"] is None
assert mine["updated_at"], "updated_at thiếu"

print("\n✓ DASHBOARD E2E PASS — progress counts khớp dữ liệu thật")

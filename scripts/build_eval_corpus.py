"""Build eval corpus — 50 academic papers từ OpenAlex cho topic academic research.

Chạy: OPENALEX_MOCK=0 python scripts/build_eval_corpus.py
Output: eval/datasets/corpus_50.jsonl (mỗi dòng một PaperOut chuẩn hóa)
"""
import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.services.openalex import _normalize_work  # noqa: E402

OPENALEX = "https://api.openalex.org/works"
MAILTO = "litreview-agent@example.com"


def fetch_page(query: str, page: int, per_page: int = 50) -> list[dict]:
    url = f"{OPENALEX}?search={urllib.parse.quote(query)}&per-page={per_page}&page={page}&mailto={MAILTO}"
    req = urllib.request.Request(url, headers={"User-Agent": f"LitReview-Agent (mailto:{MAILTO})"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read()).get("results", [])
        except urllib.error.HTTPError as e:
            if e.code in (503, 429):
                wait = 15 * (attempt + 1)
                print(f"  OpenAlex {e.code}, đợi {wait}s…", flush=True)
                time.sleep(wait)
            else:
                raise
    raise RuntimeError("OpenAlex quá tải sau 5 lần thử")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", default="retrieval augmented generation hallucination mitigation")
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--out", default="eval/datasets/corpus_50.jsonl")
    args = ap.parse_args()

    papers: list[dict] = []
    seen: set[str] = set()
    page = 1
    while len(papers) < args.limit and page <= 3:
        results = fetch_page(args.query, page)
        if not results:
            break
        for w in results:
            paper = _normalize_work(w)
            key = paper.paper_id
            if not key or key in seen:
                continue
            seen.add(key)
            papers.append(paper.model_dump())
            if len(papers) >= args.limit:
                break
        page += 1
        time.sleep(1)  # polite pool

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        for p in papers:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    with_abs = sum(1 for p in papers if p["abstract"])
    meta_only = len(papers) - with_abs
    long_abs = sum(1 for p in papers if len(p["abstract"].split()) > 300)
    years = sorted({p["year"] for p in papers if p["year"]})
    print(f"\n✓ corpus: {len(papers)} papers → {out}")
    print(f"  có abstract: {with_abs} | metadata_only: {meta_only}")
    print(f"  abstract > 300 từ: {long_abs} | năm: {years[0] if years else '—'}–{years[-1] if years else '—'}")
    print(f"  DOI unique: {len({p['doi'] for p in papers if p['doi']})}/{sum(1 for p in papers if p['doi'])}")


if __name__ == "__main__":
    main()

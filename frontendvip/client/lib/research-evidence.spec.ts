import { describe, expect, it } from "vitest";

import {
  getPaperExtraction,
  MATRIX_FIELDS,
  SUMMARY_FIELDS,
} from "./research-extraction";
import { PAPER_CATALOG } from "./research-papers";
import { answerWithEvidence, type PassageCandidate } from "./research-service";

const candidatesFor = (paperIds: string[]): PassageCandidate[] =>
  paperIds.flatMap((id) => {
    const paper = PAPER_CATALOG.find((item) => item.id === id);
    if (!paper) return [];
    return getPaperExtraction(id).passages.map((passage) => ({
      paper,
      passage,
    }));
  });

describe("extraction data", () => {
  it("links every extracted value to a passage in the same paper", () => {
    for (const paper of PAPER_CATALOG) {
      const extraction = getPaperExtraction(paper.id);
      const passageIds = new Set(extraction.passages.map((item) => item.id));
      for (const [field, entry] of Object.entries(extraction.fields)) {
        if (entry.value === null) {
          expect(entry.passageId, `${paper.id} ${field}`).toBeNull();
        } else {
          expect(passageIds.has(entry.passageId ?? ""), `${paper.id} ${field}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("covers the summary and matrix fields for every catalog paper", () => {
    for (const paper of PAPER_CATALOG) {
      const { fields } = getPaperExtraction(paper.id);
      for (const field of [...SUMMARY_FIELDS, ...MATRIX_FIELDS]) {
        expect(fields).toHaveProperty(field);
      }
    }
  });
});

describe("answerWithEvidence", () => {
  it("answers with numbered citations when passages support the question", async () => {
    const answer = await answerWithEvidence(
      "Does retrieval grounding reduce unsupported statements?",
      candidatesFor(["p-102"]),
    );

    expect(answer.sufficient).toBe(true);
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.content).toContain("[1]");
  });

  it("abstains with an insufficient-evidence result when nothing matches", async () => {
    const answer = await answerWithEvidence(
      "What is the effect on surgical outcomes?",
      candidatesFor(["p-101", "p-102", "p-103"]),
    );

    expect(answer.sufficient).toBe(false);
    expect(answer.citations).toEqual([]);
  });

  it("reports insufficient evidence when no papers are selected", async () => {
    const answer = await answerWithEvidence("Any question here?", []);

    expect(answer.sufficient).toBe(false);
    expect(answer.sources).toEqual([]);
  });
});

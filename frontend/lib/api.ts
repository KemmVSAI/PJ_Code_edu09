/**
 * API client — điểm duy nhất gọi backend FastAPI (mặc định http://localhost:8000).
 *
 * Các endpoint khớp src/api/routes.py:
 * - POST /api/v1/sessions          — tạo Research Session (FR-SES-01)
 * - GET  /api/v1/sessions          — danh sách session (Dashboard)
 * - POST /api/v1/search            — search OpenAlex (FR-SRCH-01/02/05/06)
 * - POST /api/v1/sessions/papers   — thêm paper vào Working Set (FR-SRCH-03/04)
 * - GET  /api/v1/sessions/{id}/papers — Working Set
 * - POST /api/v1/chat              — chat agent (HITL resume qua /chat/resume)
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface SessionInfo {
  session_id: string;
  research_question: string;
  corpus_version: number;
  created_at: string;
}

export interface Paper {
  paper_id: string;
  session_id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string;
  doi: string;
  abstract: string;
  source_type: "metadata_only" | "abstract";
  openalex_url: string;
}

export interface SearchResponse {
  session_id: string;
  query: string;
  results: Paper[];
  total_results: number;
  truncated: boolean;
  error: string;
}

export interface AddPapersResponse {
  session_id: string;
  added: Paper[];
  skipped_duplicates: string[];
  working_set: Paper[];
}

export interface ChatResponse {
  response: string;
  analysis: string;
  session_id: string;
}

export type ToolKind =
  | "search"
  | "screen"
  | "summary"
  | "rag"
  | "matrix"
  | "generate";

export interface ToolRequest {
  session_id: string;
  kind: ToolKind;
  payload?: string;
}

export interface ToolResponse {
  status: "ok" | "error" | "unsupported";
  message: string;
  detail?: string;
  data?: unknown;
}

// ---------------------------------------------------------------------------
// Screening (W2) — khớp src/models/schemas.py
// ---------------------------------------------------------------------------

export type ScreeningLabel = "Relevant" | "Partially Relevant" | "Not Relevant" | "Insufficient Evidence";
export type ReviewStatus = "Pending Review" | "Accepted" | "Rejected" | "Overridden";

export interface ScreeningEvidence {
  source_type: "metadata_only" | "abstract";
  source_reference: string;
  snippet: string;
}

export interface ScreeningItem {
  paper_id: string;
  title: string;
  classification_status: "pending" | "processing" | "completed" | "failed" | "timeout";
  classification_error: string;
  ai_classification: ScreeningLabel | null;
  reason: string;
  evidence: ScreeningEvidence | null;
  review_status: ReviewStatus;
  final_classification: ScreeningLabel | null;
  override_note: string;
}

export interface ScreenResponse {
  session_id: string;
  results: ScreeningItem[];
  summary: { labels: Record<string, number>; technical_failures: number; total: number };
}

export interface ReviewDecisionResponse {
  session_id: string;
  paper_id: string;
  review_status: ReviewStatus;
  final_classification: ScreeningLabel | null;
  corpus_version: number;
  in_corpus: boolean;
}

async function handle<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    const body = (await resp.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Lỗi ${resp.status} từ API`);
  }
  return (await resp.json()) as T;
}

export async function createSession(researchQuestion: string): Promise<SessionInfo> {
  const resp = await fetch(`${API_BASE}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: researchQuestion }),
  });
  return handle<SessionInfo>(resp);
}

export async function listSessions(limit = 20): Promise<SessionInfo[]> {
  const resp = await fetch(`${API_BASE}/api/v1/sessions?limit=${limit}`);
  return handle<SessionInfo[]>(resp);
}

export async function getSession(sessionId: string): Promise<SessionInfo> {
  const resp = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}`);
  return handle<SessionInfo>(resp);
}

export async function searchPapers(sessionId: string, query: string, maxResults = 10): Promise<SearchResponse> {
  const resp = await fetch(`${API_BASE}/api/v1/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, query, max_results: maxResults }),
  });
  return handle<SearchResponse>(resp);
}

export async function addPapers(sessionId: string, paperIds: string[]): Promise<AddPapersResponse> {
  const resp = await fetch(`${API_BASE}/api/v1/sessions/papers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, paper_ids: paperIds }),
  });
  return handle<AddPapersResponse>(resp);
}

export async function getWorkingSet(sessionId: string): Promise<Paper[]> {
  const resp = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/papers`);
  return handle<Paper[]>(resp);
}

export async function chat(message: string, sessionId: string): Promise<ChatResponse> {
  const resp = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  return handle<ChatResponse>(resp);
}

export async function resumeChat(sessionId: string, decision: "approve" | "reject"): Promise<ChatResponse> {
  const resp = await fetch(`${API_BASE}/api/v1/chat/resume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, resume: decision }),
  });
  return handle<ChatResponse>(resp);
}

/**
 * Gửi yêu cầu workflow (screening/summary/RAG/matrix/generate) qua agent.
 * Backend hiện lộ /chat duy nhất cho agent — tool request được đóng gói thành
 * prompt có cấu trúc để agent route; response không cấu trúc → status "ok".
 * W2–W4 sẽ thay bằng endpoint riêng khi các node Screening/Summary/RAG/Generator
 * có schema đầu ra riêng (PRD v1.1 mục 11.2).
 */
export async function runTool(request: ToolRequest): Promise<ToolResponse> {
  const prompts: Record<ToolKind, string> = {
    search: `Tìm bài báo học thuật cho: ${request.payload ?? ""}`,
    screen: `Đánh giá mức độ liên quan của các bài trong Working Set với research question hiện tại, kèm lý do và evidence`,
    summary: `Tóm tắt các bài đã chọn theo 5 trường: Research Objective, Methodology, Dataset, Results, Limitations${request.payload ? ` — paper: ${request.payload}` : ""}`,
    rag: `Trả lời câu hỏi dựa trên Confirmed Corpus, kèm citation và evidence: ${request.payload ?? ""}`,
    matrix: `Tạo Comparison Matrix cho các paper trong Confirmed Corpus`,
    generate: `Tạo Literature Review Draft (Synthesis) từ Summary và Evidence của Confirmed Corpus${request.payload ? ` — yêu cầu thêm: ${request.payload}` : ""}`,
  };
  try {
    const resp = await chat(prompts[request.kind], request.session_id);
    return { status: "ok", message: resp.response, detail: resp.analysis };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Lỗi không xác định" };
  }
}

// ---------------------------------------------------------------------------
// Screening API (W2) — endpoint thật, không qua prompt agent
// ---------------------------------------------------------------------------

export async function screenPapers(sessionId: string, paperIds?: string[]): Promise<ScreenResponse> {
  const resp = await fetch(`${API_BASE}/api/v1/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, ...(paperIds ? { paper_ids: paperIds } : {}) }),
  });
  return handle<ScreenResponse>(resp);
}

export async function getScreeningResults(sessionId: string): Promise<ScreeningItem[]> {
  const resp = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/screening`);
  return handle<ScreeningItem[]>(resp);
}

export async function submitReviewDecision(
  sessionId: string,
  paperId: string,
  decision: "accept" | "reject" | "override",
  finalClassification?: ScreeningLabel,
  overrideNote?: string,
): Promise<ReviewDecisionResponse> {
  const resp = await fetch(`${API_BASE}/api/v1/screen/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      paper_id: paperId,
      decision,
      ...(finalClassification ? { final_classification: finalClassification } : {}),
      ...(overrideNote ? { override_note: overrideNote } : {}),
    }),
  });
  return handle<ReviewDecisionResponse>(resp);
}

export async function getCorpus(sessionId: string): Promise<Paper[]> {
  const resp = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/corpus`);
  return handle<Paper[]>(resp);
}

// ---------------------------------------------------------------------------
// Summary / RAG / Generator (W3–W4) — endpoint thật, khớp schemas.py
// ---------------------------------------------------------------------------

export interface SummaryField {
  value: string;
  not_mentioned: boolean;
  provenance: string;
  user_edited?: boolean;
}

export interface SummaryInfo {
  paper_id: string;
  summary_status: "pending" | "processing" | "completed" | "failed" | "timeout";
  fields: Record<string, SummaryField>;
  source_type: string;
  user_edited: boolean;
  truncated: boolean;
}

export async function summarizePaper(sessionId: string, paperId: string): Promise<SummaryInfo> {
  const resp = await fetch(`${API_BASE}/api/v1/summary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, paper_id: paperId }),
  });
  const data = await handle<SummaryInfo & { summary_status: string }>(resp);
  return data;
}

export async function getSummaries(sessionId: string): Promise<SummaryInfo[]> {
  const resp = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/summaries`);
  return handle<SummaryInfo[]>(resp);
}

export async function editSummaryField(
  sessionId: string,
  paperId: string,
  fieldName: string,
  value: string,
): Promise<SummaryInfo> {
  const resp = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/papers/${paperId}/summary`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field_name: fieldName, value }),
  });
  return handle<SummaryInfo>(resp);
}

export type AnswerStatus =
  | "sufficient_evidence"
  | "insufficient_evidence"
  | "no_matching_evidence"
  | "failed";

export interface RAGCitation {
  paper_id: string;
  chunk_id: string;
  snippet: string;
  source_type: string;
  title: string;
}

export interface RAGResult {
  session_id: string;
  question: string;
  answer_status: AnswerStatus;
  answer: string;
  citations: RAGCitation[];
  corpus_version: number;
}

export async function askRAG(sessionId: string, question: string): Promise<RAGResult> {
  const resp = await fetch(`${API_BASE}/api/v1/rag`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, question }),
  });
  return handle<RAGResult>(resp);
}

export interface GeneratorClaim {
  claim_text: string;
  claim_type: "factual" | "synthesis" | "interpretation";
  paper_ids: string[];
  evidence_snippets: string[];
  support_status: "supported" | "partially_supported" | "unsupported";
}

export interface DraftInfo {
  session_id?: string;
  generation_status?: "completed" | "failed" | "timeout" | "no_draft";
  generation_error?: string;
  draft_id?: number;
  content: string;
  matrix: Record<string, unknown>[];
  claims: GeneratorClaim[];
  unsupported_count: number;
  status: string;
  corpus_version: number;
  content_hash: string;
}

export async function generateDraft(sessionId: string): Promise<DraftInfo> {
  const resp = await fetch(`${API_BASE}/api/v1/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  return handle<DraftInfo>(resp);
}

export async function getDraft(sessionId: string): Promise<DraftInfo> {
  const resp = await fetch(`${API_BASE}/api/v1/sessions/${sessionId}/draft`);
  return handle<DraftInfo>(resp);
}

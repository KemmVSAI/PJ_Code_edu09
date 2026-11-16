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

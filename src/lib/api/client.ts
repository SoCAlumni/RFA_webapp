import type {
  AdminAgentDetail,
  AdminAgentList,
  AgentActionResult,
  AgentView,
  ChatEvent,
  ChatStreamRequest,
  ConversationDetail,
  ConversationSummary,
  InboxDetail,
  InboxItem,
  InboxSummary,
  Me,
  PromptUpdateResult,
  PromptView,
  SandboxDetail,
  SandboxList,
  SandboxPatch,
  SandboxUpdateResult,
  SourceIn,
  SourceOut,
  SourceToggleResult,
  TaskCreateRequest,
  TaskEvent,
  TaskView,
} from "./types";

/**
 * 화면이 쓰는 rfa_mas 프런트 API 전체(FE_API_GUIDE.md 부록 표와 1:1).
 * 구현은 src/lib/api/http.ts, 요청은 같은 origin 의 /api/rfa 프록시를 거친다.
 */
export interface RfaApi {
  /* 앱 시작 */
  getMe(): Promise<Me>;
  listTasks(): Promise<TaskView[]>;
  getTask(taskId: string): Promise<TaskView>;
  listAgents(): Promise<AgentView[]>;

  /* 태스크 추가 — SSE. 스트림 전 거절은 ApiError 로 던진다 */
  createTask(req: TaskCreateRequest, signal?: AbortSignal): AsyncIterable<TaskEvent>;

  /* 비서 대화 */
  listConversations(agentId: string): Promise<ConversationSummary[]>;
  createConversation(agentId: string): Promise<ConversationSummary>;
  getConversation(id: string): Promise<ConversationDetail>;
  /** 질문 한 번 — SSE. 중지는 signal.abort() */
  chat(req: ChatStreamRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;

  /* 결재함 */
  listInbox(params?: { task?: string; status?: string }): Promise<InboxItem[]>;
  getInboxSummary(): Promise<InboxSummary>;
  getInboxItem(itemId: string): Promise<InboxDetail>;
  /** 바로 응답(승인·게시). draft 는 화면의 초안 */
  respond(itemId: string, draft?: string): Promise<InboxDetail>;
  regenerate(itemId: string, request: string): Promise<InboxDetail>;

  /* 소스(문의가 들어오는 곳) */
  listSources(taskId: string): Promise<SourceOut[]>;
  addSource(taskId: string, input: SourceIn): Promise<SourceOut>;
  removeSource(taskId: string, sourceId: string): Promise<void>;

  /* 관리 · 에이전트 */
  listAdminAgents(): Promise<AdminAgentList>;
  getAdminAgent(id: string): Promise<AdminAgentDetail>;
  compact(id: string): Promise<AgentActionResult>;
  clearMemory(id: string): Promise<AgentActionResult>;
  getPrompt(id: string): Promise<PromptView>;
  setPrompt(id: string, instructions: string): Promise<PromptUpdateResult>;
  toggleSource(id: string, sourceId: string, enabled: boolean): Promise<SourceToggleResult>;

  /* 관리 · 샌드박스 */
  listSandboxes(): Promise<SandboxList>;
  getSandbox(id: string): Promise<SandboxDetail>;
  updateSandbox(id: string, patch: SandboxPatch): Promise<SandboxUpdateResult>;
  /** 지금은 항상 409 sandbox_limit 또는 501 not_supported (FE_API_GUIDE §5.1) */
  addSandbox(): Promise<unknown>;
}

/** 서버 오류. code 로 분기하고 message 는 그대로 화면에 보인다 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = "error",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** `{code, message}` 또는 FastAPI `{detail: [{msg}]}` 를 ApiError 로 */
export function toApiError(status: number, body: unknown): ApiError {
  const b = (body ?? {}) as { code?: string; message?: string; detail?: unknown };
  const detail = Array.isArray(b.detail)
    ? (b.detail[0] as { msg?: string } | undefined)?.msg
    : typeof b.detail === "string"
      ? b.detail
      : undefined;
  const message =
    b.message ??
    detail ??
    (status === 502 || status === 503 || status === 504
      ? "서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요."
      : `요청이 실패했습니다 (${status})`);
  return new ApiError(message, status, b.code ?? (status === 422 ? "invalid_request" : "error"));
}

export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "알 수 없는 오류가 났습니다.";

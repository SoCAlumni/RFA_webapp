import { ApiError, toApiError, type RfaApi } from "./client";
import type { ChatEvent, Role, SseEnvelope, TaskEvent } from "./types";

/**
 * rfa_mas 프런트 API 구현. REST(JSON) + SSE(`POST /chat`, `POST /tasks`).
 * baseUrl 은 같은 origin 의 프록시(/api/rfa)라 CORS 가 없다. 토큰은 프록시가 서버 쪽에서 붙인다.
 */
export function createHttpApi(baseUrl: string, getRole: () => Role): RfaApi {
  const base = baseUrl.replace(/\/$/, "");
  const roleHeader = () => ({ "X-RFA-Role": getRole() });

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...roleHeader(),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError("서버에 연결할 수 없습니다.", 0, "network_error");
    }
    if (!res.ok) throw toApiError(res.status, await res.json().catch(() => null));
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  /** POST 스트림(SSE). EventSource 는 POST 를 못 써서 fetch + ReadableStream 으로 읽는다 */
  async function* sse<T>(path: string, body: unknown, signal?: AbortSignal): AsyncGenerator<SseEnvelope<T>> {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...roleHeader() },
      body: JSON.stringify(body),
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("text/event-stream") || !res.body)
      throw toApiError(res.status, await res.json().catch(() => null));
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        buf += value.replace(/\r\n/g, "\n");
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = frame
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).replace(/^ /, ""))
            .join("\n");
          if (data) yield JSON.parse(data) as SseEnvelope<T>;
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  }

  const q = encodeURIComponent;

  return {
    getMe: () => call("GET", "/me"),
    listTasks: () => call("GET", "/tasks"),
    getTask: (id) => call("GET", `/tasks/${q(id)}`),
    listAgents: () => call("GET", "/agents"),

    async *createTask(req, signal) {
      for await (const env of sse<TaskEvent["data"]>("/tasks", req, signal))
        yield { type: env.type, data: env.data } as TaskEvent;
    },

    listConversations: (agentId) => call("GET", `/conversations?agentId=${q(agentId)}`),
    createConversation: (agentId) => call("POST", "/conversations", { agentId }),
    getConversation: (id) => call("GET", `/conversations/${q(id)}`),

    async *chat(req, signal) {
      for await (const env of sse<Record<string, unknown>>("/chat", req, signal)) {
        const data = env.data ?? {};
        // run.start 의 ts 는 봉투의 unix 초 → 화면은 밀리초
        yield (env.type === "run.start"
          ? { ...data, type: env.type, runId: env.runId, ts: Math.round(env.ts * 1000) }
          : { ...data, type: env.type }) as ChatEvent;
      }
    },

    listInbox: (p) => {
      const s = new URLSearchParams();
      if (p?.task) s.set("task", p.task);
      if (p?.status) s.set("status", p.status);
      const qs = s.toString();
      return call("GET", `/inbox${qs ? `?${qs}` : ""}`);
    },
    getInboxSummary: () => call("GET", "/inbox/summary"),
    getInboxItem: (id) => call("GET", `/inbox/${q(id)}`),
    respond: (id, draft) => call("POST", `/inbox/${q(id)}/respond`, draft === undefined ? {} : { draft }),
    regenerate: (id, request) => call("POST", `/inbox/${q(id)}/regenerate`, { request }),

    listSources: (taskId) => call("GET", `/tasks/${q(taskId)}/sources`),
    addSource: (taskId, input) => call("POST", `/tasks/${q(taskId)}/sources`, input),
    removeSource: (taskId, sourceId) => call("DELETE", `/tasks/${q(taskId)}/sources/${q(sourceId)}`),

    listAdminAgents: () => call("GET", "/admin/agents"),
    getAdminAgent: (id) => call("GET", `/admin/agents/${q(id)}`),
    compact: (id) => call("POST", `/admin/agents/${q(id)}/compact`),
    clearMemory: (id) => call("POST", `/admin/agents/${q(id)}/clear-memory`),
    getPrompt: (id) => call("GET", `/admin/agents/${q(id)}/prompt`),
    setPrompt: (id, instructions) => call("PUT", `/admin/agents/${q(id)}/prompt`, { instructions }),
    toggleSource: (id, sourceId, enabled) =>
      call("PATCH", `/admin/agents/${q(id)}/sources/${q(sourceId)}`, { enabled }),

    listSandboxes: () => call("GET", "/admin/sandboxes"),
    getSandbox: (id) => call("GET", `/admin/sandboxes/${q(id)}`),
    updateSandbox: (id, patch) => call("PATCH", `/admin/sandboxes/${q(id)}`, patch),
  };
}

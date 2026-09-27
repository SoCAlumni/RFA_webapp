import type {
  AssistantTurn,
  ChatEvent,
  ChatMessage,
  HistoryItem,
  ServerChatMessage,
  TurnPhase,
  TurnStatus,
} from "@/lib/api/types";

let seq = 0;
export const newId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/** 서버가 받는 대화 id 형식([A-Za-z0-9_.:-]{1,64}). 소유자는 처음 쓸 때 서버가 저장한다 */
export function newConversationId() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `c_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function emptyTurn(id = newId("a")): AssistantTurn {
  return {
    id,
    role: "assistant",
    status: "streaming",
    phase: "understand",
    preface: "",
    calls: [],
    answer: "",
    ts: Date.now(),
  };
}

/** 스트림 이벤트 하나를 비서 답변 상태에 반영한다 (서버 TurnBuilder 와 같은 규칙) */
export function applyEvent(turn: AssistantTurn, ev: ChatEvent): AssistantTurn {
  switch (ev.type) {
    case "run.start":
      return {
        ...turn,
        runId: ev.runId,
        level: ev.level ?? turn.level,
        status: "streaming",
        phase: "understand",
        ts: ev.ts,
      };
    case "assistant.delta":
      return { ...turn, phase: "understand", preface: turn.preface + ev.text };
    case "agents.search":
      return { ...turn, phase: "search", search: { query: ev.query, candidates: ev.candidates ?? [] } };
    case "agents.select":
      return {
        ...turn,
        phase: "search",
        selection: { selected: ev.selected ?? [], skipped: ev.skipped ?? [] },
      };
    case "delegate.start":
      return {
        ...turn,
        phase: "delegate",
        calls: [
          ...turn.calls,
          { callId: ev.callId, agentId: ev.agentId, task: ev.task, status: "running", logs: [], refs: [] },
        ],
      };
    case "delegate.log":
      return {
        ...turn,
        calls: turn.calls.map((c) => (c.callId === ev.callId ? { ...c, logs: [...c.logs, ev.text] } : c)),
      };
    case "delegate.end":
      return {
        ...turn,
        calls: turn.calls.map((c) =>
          c.callId === ev.callId
            ? { ...c, status: ev.status, summary: ev.summary, refs: ev.refs ?? [], durationMs: ev.durationMs }
            : c,
        ),
      };
    case "guard.start":
      return { ...turn, phase: "guard", guard: { level: ev.level, status: "running" } };
    case "guard.end":
      return {
        ...turn,
        guard: {
          level: turn.guard?.level ?? turn.level ?? "public",
          status: ev.status,
          note: ev.note,
          redactions: ev.redactions,
        },
      };
    case "answer.delta":
      return { ...turn, phase: "answer", answer: turn.answer + ev.text };
    case "run.end": {
      const base =
        ev.status === "done"
          ? turn
          : {
              ...turn,
              calls: turn.calls.map((c) => (c.status === "running" ? { ...c, status: "error" as const } : c)),
              guard: turn.guard?.status === "running" ? undefined : turn.guard,
            };
      return {
        ...base,
        status: ev.status,
        phase: "idle",
        durationMs: ev.durationMs,
        error: ev.error ?? undefined,
        code: ev.code,
      };
    }
    default:
      return turn;
  }
}

/** `GET /conversations/{id}` 의 메시지를 화면 메시지로 (null → 빈 값, 초 → 밀리초) */
export function fromServerMessages(messages: ServerChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    const ts = Math.round((m.ts ?? 0) * 1000);
    if (m.role === "user") return { id: m.id, role: "user", text: m.text ?? "", ts };
    const status = (m.status as TurnStatus) ?? "done";
    return {
      id: m.id,
      role: "assistant",
      status,
      phase: (m.phase as TurnPhase) ?? "idle",
      preface: m.preface ?? "",
      calls: (m.calls ?? []).map((c) => ({ ...c, logs: c.logs ?? [], refs: c.refs ?? [] })),
      answer: m.answer ?? "",
      ts,
      runId: m.runId ?? undefined,
      level: m.guard?.level,
      search: m.search ?? undefined,
      selection: m.selection ?? undefined,
      guard: m.guard ?? undefined,
      durationMs: m.durationMs ?? undefined,
      error: m.error ?? undefined,
    } satisfies AssistantTurn;
  });
}

/** guest 는 서버가 이전 턴을 모르므로 클라이언트가 보낸다(≤50개, 각 ≤8000자) */
export function toHistory(messages: ChatMessage[]): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const m of messages) {
    if (m.role === "user") items.push({ role: "user", text: m.text.slice(0, 8000) });
    else if (m.status === "done" && m.answer) items.push({ role: "assistant", text: m.answer.slice(0, 8000) });
  }
  return items.slice(-50);
}

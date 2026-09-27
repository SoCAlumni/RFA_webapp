"use client";

import { applyEvent, emptyTurn, newId, toHistory } from "@/lib/chat/reducer";
import type {
  AssistantTurn,
  ChatEvent,
  ChatMessage,
  ChatStreamRequest,
  Role,
  UserMessage,
} from "@/lib/api/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type RunQuery = (req: ChatStreamRequest, signal: AbortSignal) => AsyncIterable<ChatEvent>;

export interface ChatTarget {
  role: Role;
  /** 지정 대화면 에이전트 id (비서면 생략) */
  agentId?: string;
  /** 이 대화창의 대화 id. 대화마다 스트림 · AbortController 를 따로 둔다 */
  conversationId: string;
}

/** 한 대화창의 메시지 목록과 전송 · 중지 */
export function useChat(runQuery: RunQuery, initial: ChatMessage[] = [], target: ChatTarget) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  // 보낼 때 최신 값을 읽도록 렌더가 끝난 뒤 맞춰 둔다
  const latest = useRef({ target, messages });
  useEffect(() => {
    latest.current = { target, messages };
  });
  const [busy, setBusy] = useState(false);
  const running = useRef<AbortController | null>(null);

  // 대화창이 사라지면 스트림도 끊는다
  useEffect(() => () => running.current?.abort(), []);

  const stop = useCallback(() => running.current?.abort(), []);
  const reset = useCallback(() => {
    running.current?.abort();
    setMessages([]);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, 10000);
      if (!text || running.current) return;
      const user: UserMessage = { id: newId("u"), role: "user", text, ts: Date.now() };
      const turnId = newId("a");
      const { target: t, messages: prev } = latest.current;
      setMessages((m) => [...m, user, emptyTurn(turnId)]);
      const ac = new AbortController();
      running.current = ac;
      setBusy(true);
      const update = (fn: (turn: AssistantTurn) => AssistantTurn) =>
        setMessages((m) => m.map((x) => (x.id === turnId && x.role === "assistant" ? fn(x) : x)));
      const started = Date.now();
      const req: ChatStreamRequest = {
        text,
        role: t.role,
        conversationId: t.conversationId,
        ...(t.agentId ? { agentId: t.agentId } : {}),
        // 소유자는 서버가 이전 턴을 가진다. 게스트만 클라이언트가 보낸다(D-7)
        ...(t.role === "guest" ? { history: toHistory(prev) } : {}),
      };
      try {
        for await (const ev of runQuery(req, ac.signal)) {
          if (ac.signal.aborted) break;
          update((turn) => applyEvent(turn, ev));
        }
        // 서버가 run.end 없이 끝냈거나 사용자가 중지함
        update((turn) =>
          turn.status === "streaming"
            ? applyEvent(turn, {
                type: "run.end",
                status: ac.signal.aborted ? "stopped" : "error",
                durationMs: Date.now() - started,
                error: ac.signal.aborted ? undefined : "응답이 중간에 끊겼습니다",
              })
            : turn,
        );
      } catch (e) {
        const stopped = ac.signal.aborted || (e instanceof DOMException && e.name === "AbortError");
        const message = e instanceof Error ? e.message : String(e);
        update((turn) =>
          turn.status === "streaming"
            ? applyEvent(turn, {
                type: "run.end",
                status: stopped ? "stopped" : "error",
                durationMs: Date.now() - started,
                error: stopped ? undefined : message,
              })
            : turn,
        );
      } finally {
        running.current = null;
        setBusy(false);
      }
    },
    [runQuery],
  );

  return { messages, busy, send, stop, reset };
}

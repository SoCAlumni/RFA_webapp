"use client";

import { applyEvent, emptyTurn, newId } from "@/lib/chat/reducer";
import type {
  AssistantTurn,
  ChatEvent,
  ChatMessage,
  ChatRequest,
  Role,
  UserMessage,
} from "@/lib/api/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type RunQuery = (req: ChatRequest, signal: AbortSignal) => AsyncIterable<ChatEvent>;

/** 한 대화창의 메시지 목록과 전송 · 중지 */
export function useChat(
  runQuery: RunQuery,
  initial: ChatMessage[] = [],
  role: Role = "owner",
  agentId?: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  // 보낼 때 최신 값을 읽도록 렌더가 끝난 뒤 맞춰 둔다
  const latest = useRef({ role, agentId, messages });
  useEffect(() => {
    latest.current = { role, agentId, messages };
  });
  const [busy, setBusy] = useState(false);
  const running = useRef<AbortController | null>(null);

  const stop = useCallback(() => running.current?.abort(), []);
  const reset = useCallback(() => {
    running.current?.abort();
    setMessages([]);
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || running.current) return;
      const user: UserMessage = { id: newId("u"), role: "user", text, ts: Date.now() };
      const turnId = newId("a");
      const { role: who, agentId: target, messages: history } = latest.current;
      setMessages((prev) => [...prev, user, emptyTurn(turnId)]);
      const ac = new AbortController();
      running.current = ac;
      setBusy(true);
      const update = (fn: (t: AssistantTurn) => AssistantTurn) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === turnId && m.role === "assistant" ? fn(m) : m)),
        );
      const started = Date.now();
      try {
        for await (const ev of runQuery(
          { text, role: who, agentId: target, history: [...history, user] },
          ac.signal,
        )) {
          if (ac.signal.aborted) break;
          update((t) => applyEvent(t, ev));
        }
        if (ac.signal.aborted)
          update((t) =>
            t.status === "streaming"
              ? applyEvent(t, { type: "run.end", status: "stopped", durationMs: Date.now() - started })
              : t,
          );
      } catch (e) {
        const stopped =
          ac.signal.aborted || (e instanceof DOMException && e.name === "AbortError");
        const message = e instanceof Error ? e.message : String(e);
        update((t) =>
          t.status === "streaming"
            ? applyEvent(t, {
                type: "run.end",
                status: stopped ? "stopped" : "error",
                durationMs: Date.now() - started,
                error: stopped ? undefined : message,
              })
            : t,
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

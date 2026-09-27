"use client";

import { ICON_PATHS } from "@/components/icons";
import { fromServerMessages, newConversationId } from "@/lib/chat/reducer";
import type { AgentView, ChatMessage, ConversationDetail, ConversationSummary } from "@/lib/api/types";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChatPane, STATUS_LABEL, type ChatPaneProps } from "./ChatPane";

function when(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (Date.now() - ts < 60_000) return "방금";
  if (d.toDateString() === now.toDateString()) {
    const h = d.getHours();
    return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return d.toDateString() === y.toDateString() ? "어제" : `${d.getMonth() + 1}/${d.getDate()}`;
}

interface Summary {
  title: string;
  preview: string;
  /** 밀리초 */
  updatedAt: number;
  busy: boolean;
  count: number;
}

function summarize(messages: ChatMessage[], createdAt: number): Summary {
  const firstUser = messages.find((m) => m.role === "user");
  const last = messages[messages.length - 1];
  const lastTurn = [...messages].reverse().find((m) => m.role === "assistant");
  const busy = lastTurn?.role === "assistant" && lastTurn.status === "streaming";
  let preview = "";
  if (busy) preview = "답변 중…";
  else if (lastTurn?.role === "assistant" && lastTurn.answer) preview = lastTurn.answer.replace(/\s+/g, " ");
  else if (firstUser?.role === "user") preview = firstUser.text;
  return {
    title: firstUser?.role === "user" ? firstUser.text : "새 대화",
    preview,
    updatedAt: last?.ts ?? createdAt,
    busy: !!busy,
    count: messages.filter((m) => m.role === "user").length,
  };
}

const fromServerSummary = (c: ConversationSummary): Summary => ({
  title: c.title || "새 대화",
  preview: c.busy ? "답변 중…" : c.preview,
  updatedAt: c.updatedAt * 1000,
  busy: c.busy,
  count: c.count,
});

const svg = {
  collapse: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M15 10l-2 2 2 2" />
    </svg>
  ),
  expand: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="M13 10l2 2-2 2" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
};

function Face({ agent, size, busy }: { agent: AgentView; size: "xs" | "sm" | "md" | "lg"; busy?: boolean }) {
  const c = agent.color ?? { bg: "#eceef2", fg: "#1a1d23" };
  const text = agent.icon === "generic" && agent.initials ? agent.initials : null;
  return (
    <span
      className={`cw-face cw-face-${size} ${agent.kind === "assistant" ? "cw-face-assistant" : ""}`}
      style={{
        background: c.bg,
        color: c.fg,
        ...(text ? { fontSize: size === "xs" ? 8 : size === "sm" ? 10 : 12, fontWeight: 700, letterSpacing: "-0.03em" } : {}),
      }}
      aria-hidden="true"
    >
      {text ?? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: ICON_PATHS[agent.icon ?? "generic"] ?? ICON_PATHS.generic }}
        />
      )}
      {size === "xs" ? null : busy || agent.status === "applying" ? (
        <span className="cw-busy" />
      ) : (
        agent.status !== "stopped" && <span className="cw-dot" />
      )}
    </span>
  );
}

interface Session {
  /** 서버 대화 id. 새 대화는 브라우저가 만들고 소유자라면 첫 질문 때 서버가 저장한다 */
  id: string;
  agentId: string;
  /** 밀리초 */
  createdAt: number;
  /** 서버에 저장된 대화(아직 안 불러왔을 수 있다) */
  remote?: boolean;
  /** 대화창에 그릴 메시지가 준비됐는지 */
  loaded: boolean;
  seed?: ChatMessage[];
}

export interface ChatWorkspaceProps
  extends Omit<
    ChatPaneProps,
    "focusAgentId" | "initialMessages" | "onMessagesChange" | "onNewChat" | "conversationId"
  > {
  selectedAgentId?: string;
  onSelectAgent?: (agentId: string) => void;
  /** 소유자의 저장된 대화 목록(게스트는 빈 배열) */
  remote?: ConversationSummary[];
  loadConversation?: (id: string) => Promise<ConversationDetail>;
}

interface WorkspaceState {
  sessions: Session[];
  summaries: Record<string, Summary>;
  /** 담당자별로 마지막으로 연 대화 */
  current: Record<string, string>;
  active: string;
  /** 한 번이라도 연 대화(열린 채로 두어 답변이 이어지게) */
  mounted: string[];
}

type Action =
  | { type: "select"; agentId: string; fallbackId: string }
  | { type: "new"; agentId: string; id: string; at: number }
  | { type: "open"; id: string }
  | { type: "summary"; id: string; summary: Summary }
  | { type: "remote"; list: ConversationSummary[] }
  | { type: "loaded"; id: string; messages: ChatMessage[]; summary?: Summary };

const mount = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

const isEmptyLocal = (st: WorkspaceState, id?: string) => {
  const s = id ? st.sessions.find((x) => x.id === id) : undefined;
  return !!s && !s.remote && (st.summaries[s.id]?.count ?? 0) === 0;
};

/** 가장 최근 대화(질문이 있는 것 먼저) */
function latestSession(st: WorkspaceState, agentId: string) {
  const time = (s: Session) => st.summaries[s.id]?.updatedAt ?? s.createdAt;
  return st.sessions
    .filter((s) => s.agentId === agentId)
    .sort((a, b) => {
      const used = Number((st.summaries[b.id]?.count ?? 0) > 0) - Number((st.summaries[a.id]?.count ?? 0) > 0);
      return used || time(b) - time(a);
    })[0];
}

/** 담당자를 고르면: 마지막으로 연 대화 → 가장 최근 대화 → 없으면 새 대화(FE_API_GUIDE §2.1) */
function focusAgent(st: WorkspaceState, agentId: string, fallbackId: string): WorkspaceState {
  const cur = st.current[agentId];
  if (cur && st.sessions.some((s) => s.id === cur))
    return { ...st, active: agentId, mounted: mount(st.mounted, cur) };
  const latest = latestSession(st, agentId);
  if (latest)
    return { ...st, active: agentId, current: { ...st.current, [agentId]: latest.id }, mounted: mount(st.mounted, latest.id) };
  return {
    ...st,
    active: agentId,
    sessions: [...st.sessions, { id: fallbackId, agentId, createdAt: Date.now(), loaded: true }],
    current: { ...st.current, [agentId]: fallbackId },
    mounted: mount(st.mounted, fallbackId),
  };
}

function reducer(st: WorkspaceState, a: Action): WorkspaceState {
  switch (a.type) {
    case "select":
      return focusAgent(st, a.agentId, a.fallbackId);
    case "new": {
      // 아직 아무것도 묻지 않은 새 대화가 열려 있으면 그대로 쓴다
      if (isEmptyLocal(st, st.current[a.agentId])) return st;
      return {
        ...st,
        sessions: [...st.sessions, { id: a.id, agentId: a.agentId, createdAt: a.at, loaded: true }],
        current: { ...st.current, [a.agentId]: a.id },
        mounted: mount(st.mounted, a.id),
      };
    }
    case "open":
      return { ...st, current: { ...st.current, [st.active]: a.id }, mounted: mount(st.mounted, a.id) };
    case "summary":
      return { ...st, summaries: { ...st.summaries, [a.id]: a.summary } };
    case "remote": {
      const known = new Set(st.sessions.map((s) => s.id));
      const added = a.list
        .filter((c) => !known.has(c.id))
        .map((c): Session => ({ id: c.id, agentId: c.agentId, createdAt: c.createdAt * 1000, remote: true, loaded: false }));
      const summaries = { ...st.summaries };
      for (const c of a.list) {
        const local = summaries[c.id];
        // 이 브라우저에서 답변 중인 대화는 화면 쪽 요약이 더 새롭다
        if (!local?.busy) summaries[c.id] = fromServerSummary(c);
      }
      let next: WorkspaceState = { ...st, sessions: [...st.sessions, ...added], summaries };
      // 처음 목록이 오기 전에 연 빈 새 대화는 가장 최근 저장 대화로 바꾼다
      for (const [agentId, id] of Object.entries(st.current)) {
        if (!isEmptyLocal(next, id)) continue;
        const latest = latestSession({ ...next, current: {} }, agentId);
        if (latest?.remote) {
          next = {
            ...next,
            current: { ...next.current, [agentId]: latest.id },
            mounted: agentId === next.active ? mount(next.mounted, latest.id) : next.mounted,
          };
        }
      }
      return next;
    }
    case "loaded":
      return {
        ...st,
        sessions: st.sessions.map((s) => (s.id === a.id ? { ...s, loaded: true, seed: a.messages } : s)),
        summaries: a.summary ? { ...st.summaries, [a.id]: a.summary } : st.summaries,
      };
  }
}

function SessionPane({
  session,
  dispatch,
  ...pane
}: Omit<ChatPaneProps, "onMessagesChange" | "onNewChat" | "initialMessages" | "conversationId"> & {
  session: Session;
  dispatch: (a: Action) => void;
}) {
  const { id, createdAt, agentId } = session;
  const onMessagesChange = useCallback(
    (m: ChatMessage[]) => {
      if (m.length) dispatch({ type: "summary", id, summary: summarize(m, createdAt) });
    },
    [dispatch, id, createdAt],
  );
  return (
    <ChatPane
      {...pane}
      conversationId={id}
      initialMessages={session.seed}
      onMessagesChange={onMessagesChange}
      onNewChat={() => dispatch({ type: "new", agentId, id: newConversationId(), at: Date.now() })}
    />
  );
}

/** 대화 상대 목록(왼쪽) + 상대별 대화 내역 + 대화창 */
export function ChatWorkspace(props: ChatWorkspaceProps) {
  const {
    assistant,
    agents,
    selectedAgentId,
    onSelectAgent,
    remote,
    loadConversation,
    ...paneProps
  } = props;

  const people = useMemo(() => [assistant, ...agents.filter((a) => a.kind === "task")], [assistant, agents]);
  const byId = useMemo(() => new Map(people.map((a) => [a.id, a])), [people]);

  const [st, dispatch] = useReducer(reducer, null, () => {
    const active = selectedAgentId && byId.has(selectedAgentId) ? selectedAgentId : assistant.id;
    return focusAgent({ sessions: [], summaries: {}, current: {}, active, mounted: [] }, active, newConversationId());
  });
  const { sessions, summaries, current, active, mounted } = st;

  // 서버의 저장된 대화 목록이 오면 합친다
  useEffect(() => {
    if (remote) dispatch({ type: "remote", list: remote });
  }, [remote]);

  // 연 대화가 서버 대화면 메시지를 불러온다. 다른 곳에서 답변 중이면 끝날 때까지 기다렸다 다시 부른다
  const currentId = current[active];
  const currentSession = sessions.find((s) => s.id === currentId);
  const [waiting, setWaiting] = useState<string | null>(null);
  useEffect(() => {
    if (!currentSession || currentSession.loaded || !loadConversation) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fetchOnce = () =>
      loadConversation(currentSession.id).then(
        (d) => {
          if (!alive) return;
          if (d.busy) {
            setWaiting(d.id);
            timer = setTimeout(fetchOnce, 4000);
            return;
          }
          setWaiting(null);
          const messages = fromServerMessages(d.messages);
          dispatch({ type: "loaded", id: d.id, messages, summary: fromServerSummary(d) });
        },
        () => {
          if (alive) dispatch({ type: "loaded", id: currentSession.id, messages: [] });
        },
      );
    fetchOnce();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [currentSession, loadConversation]);

  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const lastNarrow = useRef(false);

  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const n = e.contentRect.width < 820;
      if (n === lastNarrow.current) return;
      lastNarrow.current = n;
      setNarrow(n);
      setCollapsed(n);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const select = (agentId: string, notify = true) => {
    if (!byId.has(agentId)) return;
    dispatch({ type: "select", agentId, fallbackId: newConversationId() });
    if (narrow) setCollapsed(true);
    if (notify) onSelectAgent?.(agentId);
  };

  // 주소(선택한 담당자)가 바뀌거나, 기다리던 담당자가 새로 생기면 따라간다
  const wanted = selectedAgentId ?? assistant.id;
  const syncKey = `${wanted}|${byId.size}`;
  const [lastSync, setLastSync] = useState(syncKey);
  if (lastSync !== syncKey) {
    setLastSync(syncKey);
    if (byId.has(wanted) && wanted !== active) select(wanted, false);
  }

  const sessionsOf = (agentId: string) =>
    sessions
      .filter((s) => s.agentId === agentId)
      .sort((a, b) => (summaries[b.id]?.updatedAt ?? b.createdAt) - (summaries[a.id]?.updatedAt ?? a.createdAt));

  const newSession = (agentId: string) =>
    dispatch({ type: "new", agentId, id: newConversationId(), at: Date.now() });

  const openSession = (id: string) => {
    dispatch({ type: "open", id });
    if (narrow) setCollapsed(true);
  };

  const me = byId.get(active) ?? assistant;
  const history = sessionsOf(active).filter((s) => (summaries[s.id]?.count ?? 0) > 0);
  const others = people.filter((a) => a.id !== active);
  const latestOf = (agentId: string) => {
    const s = sessionsOf(agentId).find((x) => (summaries[x.id]?.count ?? 0) > 0);
    return s ? summaries[s.id] : undefined;
  };
  const isBusy = (agentId: string) => sessions.some((s) => s.agentId === agentId && summaries[s.id]?.busy);
  const subtitleOf = (a: AgentView) =>
    a.kind === "assistant"
      ? `담당자 ${agents.filter((x) => x.kind === "task").length}명을 관장`
      : [a.status && STATUS_LABEL[a.status], a.taskName].filter(Boolean).join(" · ");

  /* ---------- 대화 상대 바꾸기 메뉴 ---------- */

  const [menu, setMenu] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);

  const openMenu = (btn: HTMLElement, where: "below" | "right", anchor: HTMLElement = btn) => {
    trigger.current = btn;
    const r = anchor.getBoundingClientRect();
    const width = Math.max(264, where === "below" ? r.width : 264);
    let left = where === "below" ? r.left : r.right + 8;
    left = Math.min(left, window.innerWidth - width - 8);
    const top = where === "below" ? r.bottom + 6 : r.top;
    setMenu({ top, left: Math.max(8, left), width, maxHeight: Math.max(160, window.innerHeight - top - 12) });
  };
  const closeMenu = (refocus = true) => {
    setMenu(null);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => {
    if (!menu) return;
    const items = () =>
      Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
    (items().find((el) => el.getAttribute("aria-checked") === "true") ?? items()[0])?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !trigger.current?.contains(t)) closeMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        list[(i + 1) % list.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        list[(i - 1 + list.length) % list.length]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        list[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        list[list.length - 1]?.focus();
      } else if (e.key === "Tab") closeMenu(false);
    };
    const onResize = () => closeMenu(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
    };
  }, [menu]);

  const pick = (agentId: string) => {
    closeMenu();
    if (agentId !== active) select(agentId);
  };

  const stack = others.slice(0, 3);
  const othersBusy = others.some((a) => isBusy(a.id));

  return (
    <div className="cw-root" ref={root} data-collapsed={collapsed || undefined} data-narrow={narrow || undefined}>
      {narrow && !collapsed && <div className="cw-scrim" onClick={() => setCollapsed(true)} aria-hidden="true" />}
      <aside className="cw-rail" aria-label="대화할 에이전트">
        <div className="cw-rail-head">
          {!collapsed && <span>대화 상대</span>}
          <button
            type="button"
            className="cw-icon"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "대화 상대 펼치기" : "대화 상대 접기"}
            aria-expanded={!collapsed}
            title={collapsed ? "펼치기" : "접기"}
          >
            {collapsed ? svg.expand : svg.collapse}
          </button>
        </div>
        {collapsed ? (
          <div className="cw-strip">
            <button
              type="button"
              className="cw-strip-item"
              aria-current="true"
              aria-haspopup="menu"
              aria-expanded={!!menu}
              onClick={(e) => (menu ? closeMenu() : openMenu(e.currentTarget, "right"))}
              title={`${me.name} · 대화 상대 바꾸기`}
              aria-label={`${me.name}와 대화 중. 대화 상대 바꾸기`}
            >
              <Face agent={me} size="md" busy={isBusy(me.id)} />
            </button>
            <button type="button" className="cw-icon" onClick={() => newSession(active)} aria-label="새 대화" title="새 대화">
              {svg.plus}
            </button>
          </div>
        ) : (
          <div className="cw-rail-body">
            <section className="cw-me" aria-label="지금 대화 상대">
              <div className="cw-me-top">
                <Face agent={me} size="lg" busy={isBusy(me.id)} />
                <div className="cw-me-name">
                  <b>{me.name}</b>
                  <span>{subtitleOf(me)}</span>
                </div>
              </div>
              {me.kind === "assistant" && <p className="cw-me-desc">질문에 맞는 담당자를 찾아 확인한 뒤 답합니다.</p>}
              {me.kind !== "assistant" && me.description && <p className="cw-me-desc">{me.description}</p>}
              {others.length > 0 && (
                <button
                  type="button"
                  className="cw-switch"
                  aria-haspopup="menu"
                  aria-expanded={!!menu}
                  onClick={(e) =>
                    menu
                      ? closeMenu()
                      : openMenu(
                          e.currentTarget,
                          "below",
                          (e.currentTarget.closest(".cw-me") as HTMLElement) ?? e.currentTarget,
                        )
                  }
                >
                  <span className="cw-stack" aria-hidden="true">
                    {stack.map((a) => (
                      <Face key={a.id} agent={a} size="xs" />
                    ))}
                    {others.length > stack.length && (
                      <span className="cw-stack-more">+{others.length - stack.length}</span>
                    )}
                  </span>
                  <span className="cw-switch-text">바꾸기</span>
                  {othersBusy && <span className="cw-busy-inline" aria-label="다른 대화에서 답변 중" />}
                  <svg className="cw-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              )}
            </section>
            <section className="cw-history" aria-label={`${me.name}와의 대화 내역`}>
              <div className="cw-label">
                <span>대화 내역</span>
              </div>
              <button type="button" className="cw-new" onClick={() => newSession(active)}>
                {svg.plus}새 대화
              </button>
              {history.length === 0 ? (
                <p className="cw-empty">아직 나눈 대화가 없습니다</p>
              ) : (
                <ul>
                  {history.map((s) => {
                    const sum = summaries[s.id];
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="cw-session"
                          aria-current={s.id === current[active] || undefined}
                          onClick={() => openSession(s.id)}
                          title={sum?.preview}
                        >
                          <span className="cw-session-title">{sum?.count ? sum.title : "새 대화"}</span>
                          <span className="cw-session-when">
                            {sum?.busy ? <span className="cw-busy-inline" /> : when(sum?.updatedAt ?? s.createdAt)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}
      </aside>
      {menu && (
        <div
          ref={menuRef}
          className="cw-menu"
          role="menu"
          aria-label="대화 상대 바꾸기"
          style={{ top: menu.top, left: menu.left, width: menu.width, maxHeight: menu.maxHeight }}
        >
          <div className="cw-menu-head">대화 상대 바꾸기</div>
          {people.map((a) => {
            const latest = latestOf(a.id);
            const checked = a.id === active;
            return (
              <button
                key={a.id}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                className="cw-menu-item"
                onClick={() => pick(a.id)}
              >
                <Face agent={a} size="sm" busy={isBusy(a.id)} />
                <span className="cw-menu-text">
                  <b>{a.name}</b>
                  <span>{latest ? (latest.busy ? "답변 중…" : latest.title) : subtitleOf(a)}</span>
                </span>
                {checked ? (
                  <svg className="cw-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                ) : latest && !latest.busy ? (
                  <span className="cw-menu-when">{when(latest.updatedAt)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      <div className="cw-main">
        {sessions
          .filter((s) => mounted.includes(s.id) && s.loaded)
          .map((s) => (
            <div key={s.id} className="cw-pane" hidden={!(s.agentId === active && s.id === current[active])}>
              <SessionPane
                {...paneProps}
                session={s}
                dispatch={dispatch}
                assistant={assistant}
                agents={agents}
                focusAgentId={s.agentId === assistant.id ? undefined : s.agentId}
              />
            </div>
          ))}
        {currentSession && !currentSession.loaded && (
          <div className="cw-pane">
            <div className="loading">
              <span className="spin" aria-hidden="true" />
              {waiting === currentSession.id ? "다른 곳에서 답변 중입니다. 끝나면 불러옵니다" : "대화를 불러오는 중"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

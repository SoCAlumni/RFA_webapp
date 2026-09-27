"use client";

import { AgentIcon } from "@/components/icons";
import { Markdown } from "@/components/Markdown";
import type {
  AgentStatus,
  AgentView,
  AssistantTurn,
  ChatMessage,
  DelegateCall,
  RefLink,
  Role,
  SandboxLevel,
} from "@/lib/api/types";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useChat, type RunQuery } from "./useChat";

/* ---------- 작은 조각 ---------- */

const Chevron = () => (
  <svg className="cp-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);
const Dash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
    <path d="M6 12h12" />
  </svg>
);
const Cross = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const Spin = () => <span className="cp-spin" aria-hidden="true" />;
const Lock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const ROLE_LABEL: Record<Role, string> = { owner: "소유자", guest: "게스트" };
const GRADE_OF: Record<SandboxLevel, string> = { public: "사외", company: "사내" };
const gradeOf = (level?: string) => GRADE_OF[level as SandboxLevel] ?? "사외";
export const STATUS_LABEL: Record<AgentStatus, string> = {
  running: "실행 중",
  waiting_decision: "결정 대기",
  stopped: "꺼짐",
  applying: "만드는 중",
};

const clock = (ts: number) => {
  const d = new Date(ts);
  const h = d.getHours();
  return `${h < 12 ? "오전" : "오후"} ${h % 12 || 12}:${d.getMinutes().toString().padStart(2, "0")}`;
};
const seconds = (ms?: number) => (ms == null ? "" : `${(ms / 1000).toFixed(1)}초`);

function RoleSwitch({
  authenticated,
  role,
  onChange,
}: {
  authenticated: boolean;
  role: Role;
  onChange?: (r: Role) => void;
}) {
  if (!authenticated)
    return (
      <span className="cp-perm" role="status">
        <Lock />
        권한을 할당받으세요
      </span>
    );
  return (
    <div className="cp-seg" role="group" aria-label="권한">
      {(["owner", "guest"] as const).map((r) => (
        <button key={r} type="button" aria-pressed={role === r} onClick={() => role !== r && onChange?.(r)}>
          {ROLE_LABEL[r]}
        </button>
      ))}
    </div>
  );
}

export function Avatar({
  agent,
  size = "md",
  presence,
}: {
  agent?: AgentView;
  size?: "sm" | "md" | "lg";
  presence?: boolean;
}) {
  const c = agent?.color ?? { bg: "#eceef2", fg: "#1a1d23" };
  const text = agent?.icon === "generic" && agent.initials ? agent.initials : null;
  return (
    <span
      className={`cp-avatar ${size === "sm" ? "cp-avatar-sm" : size === "lg" ? "cp-avatar-lg" : ""} ${agent?.kind === "assistant" ? "cp-avatar-assistant" : ""}`}
      style={{ background: c.bg, color: c.fg, ...(text && size === "sm" ? { fontSize: 9 } : {}) }}
      aria-hidden="true"
    >
      {text ?? <AgentIcon name={agent?.icon ?? "generic"} />}
      {presence && <span className="cp-presence" />}
    </span>
  );
}

function RefChip({ r, onClick }: { r: RefLink; onClick?: (r: RefLink) => void }) {
  return (
    <button type="button" className="cp-ref" data-status={r.status} onClick={() => onClick?.(r)}>
      <i aria-hidden="true" />
      <b>{r.label}</b>
      {r.status && <span>{r.status}</span>}
    </button>
  );
}

type StepState = "done" | "active" | "pending";

function stepStates(t: AssistantTurn) {
  const order = ["understand", "search", "delegate", "guard", "answer", "idle"];
  const now = order.indexOf(t.phase);
  const finished = t.status !== "streaming";
  const idx = (p: string) => order.indexOf(p);
  const state = (from: string, until: string): StepState =>
    finished || now > idx(until) ? "done" : now >= idx(from) ? "active" : "pending";
  const s = {
    understand: state("understand", "understand"),
    search: state("search", "delegate"),
    guard: state("guard", "guard"),
  };
  if (finished) {
    if (!t.preface) s.understand = "pending";
    if (!t.search && !t.calls.length) s.search = "pending";
    if (!t.guard) s.guard = "pending";
  }
  return s;
}

function traceHeadline(t: AssistantTurn, agents: Map<string, AgentView>) {
  const n = t.calls.length;
  const waiting = t.calls.filter((c) => c.status === "running").length;
  if (t.status === "streaming")
    switch (t.phase) {
      case "understand":
        return { main: "요청을 파악하는 중" };
      case "search":
        return {
          main:
            t.search && !t.search.candidates.length
              ? "맞는 담당자가 없어 직접 답합니다"
              : "담당자를 찾는 중",
        };
      case "delegate":
        return {
          main: `담당자 ${n}명에게 확인 중`,
          sub: waiting ? `${waiting}명 응답 기다리는 중` : "모두 응답함",
        };
      case "guard":
        return { main: "공개 등급 검사 중" };
      case "answer":
        return { main: "답변 작성 중" };
      default:
        return { main: "진행 중" };
    }
  if (t.status === "stopped") return { main: "중지됨", sub: n ? `담당자 ${n}명 호출` : undefined };
  if (t.status === "error") return { main: "실패", sub: t.error };
  const names = t.calls
    .map((c) => agents.get(c.agentId)?.name.replace(/ 에이전트$/, ""))
    .filter(Boolean);
  return {
    main: n ? `담당자 ${n}명에게 확인` : "직접 답변",
    sub: [names.join(", "), seconds(t.durationMs)].filter(Boolean).join(" · "),
  };
}

function Step({
  status,
  title,
  meta,
  children,
}: {
  status: StepState;
  title: string;
  meta?: string;
  children?: ReactNode;
}) {
  return (
    <div className="cp-step" data-status={status}>
      <span className="cp-step-mark" aria-hidden="true">
        {status === "done" ? <Check /> : status === "active" ? <Spin /> : null}
      </span>
      <div className="cp-step-main">
        <div className="cp-step-title">
          <b>{title}</b>
          {meta && <span>{meta}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

function AgentRow({
  agent,
  agentId,
  reason,
  score,
  call,
  onRefClick,
}: {
  agent?: AgentView;
  agentId: string;
  reason?: string;
  score?: number;
  call?: DelegateCall;
  onRefClick?: (r: RefLink) => void;
}) {
  const [open, setOpen] = useState(false);
  const s = call?.status;
  const label = call
    ? s === "running"
      ? "응답 기다리는 중"
      : s === "ok"
        ? `답 받음 · ${seconds(call.durationMs)}`
        : s === "none"
          ? `해당 없음 · ${seconds(call.durationMs)}`
          : s === "blocked"
            ? "샌드박스 정책으로 차단됨"
            : "실패"
    : "찾음";
  const line = call?.status === "running" ? (call.logs.at(-1) ?? call.task) : (call?.summary ?? reason);
  const expandable = !!call;
  return (
    <div className="cp-agent" data-status={s ?? "found"}>
      <button
        type="button"
        className="cp-agent-row"
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
        onClick={() => expandable && setOpen((v) => !v)}
      >
        <Avatar agent={agent} size="sm" />
        <span className="cp-agent-name">
          <b>{agent?.name ?? agentId}</b>
          <span>{line}</span>
        </span>
        <span className="cp-agent-status" data-status={s ?? "found"}>
          {call ? (
            s === "running" ? <Spin /> : s === "ok" ? <Check /> : s === "none" ? <Dash /> : <Cross />
          ) : (
            score != null && (
              <span className="cp-bar">
                <i style={{ width: `${Math.round(score * 100)}%` }} />
              </span>
            )
          )}
          <span className="cp-agent-status-label">{label}</span>
        </span>
        {expandable && <Chevron />}
      </button>
      {expandable && open && call && (
        <div className="cp-agent-detail">
          <div className="cp-call-task">{call.task}</div>
          {call.logs.length > 0 && (
            <ul className="cp-call-log">
              {call.logs.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
          {call.summary && <div className="cp-call-summary">{call.summary}</div>}
          {call.refs.length > 0 && (
            <div className="cp-refs">
              {call.refs.map((r) => (
                <RefChip key={`${r.kind}:${r.id}`} r={r} onClick={onRefClick} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Trace({
  turn,
  agents,
  onRefClick,
}: {
  turn: AssistantTurn;
  agents: Map<string, AgentView>;
  onRefClick?: (r: RefLink) => void;
}) {
  const streaming = turn.status === "streaming";
  const [open, setOpen] = useState(true);
  const st = stepStates(turn);
  const head = traceHeadline(turn, agents);
  const list = [st.understand, st.search, st.guard];
  const lastShown = list.map((v) => v !== "pending").lastIndexOf(true);
  const show = (i: number) => list[i] !== "pending" || i > lastShown;
  const skipped = new Set(turn.selection?.skipped.map((s) => s.agentId) ?? []);
  const people: { agentId: string; reason?: string; score?: number }[] = (
    turn.search?.candidates ?? []
  ).filter((c) => !skipped.has(c.agentId));
  for (const c of turn.calls)
    if (!people.some((p) => p.agentId === c.agentId)) people.push({ agentId: c.agentId });
  const guardLabel = turn.guard
    ? turn.guard.status === "running"
      ? `${gradeOf(turn.guard.level)} 등급으로 검사 중`
      : turn.guard.status === "pass"
        ? "통과"
        : turn.guard.status === "redacted"
          ? `${turn.guard.redactions ?? ""}건 제외`
          : "차단"
    : undefined;

  return (
    <div className="cp-trace">
      <button type="button" className="cp-trace-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {streaming ? <Spin /> : null}
        <b>{head.main}</b>
        {head.sub && <span className="cp-muted">{head.sub}</span>}
        <span className="cp-grow" />
        <Chevron />
      </button>
      {open && (
        <div className="cp-trace-body">
          {show(0) && (
            <Step status={st.understand} title="요청 파악">
              {turn.preface && (
                <div className="cp-step-text">
                  {turn.preface}
                  {st.understand === "active" && <span className="cp-caret" />}
                </div>
              )}
            </Step>
          )}
          {show(1) && (
            <Step
              status={st.search}
              title="담당자 탐색"
              meta={people.length ? `${people.length}명` : turn.search?.query}
            >
              {turn.search && people.length === 0 && (
                <div className="cp-step-text cp-step-none">
                  맞는 담당자가 없습니다. {"​"}비서가 직접 답합니다.
                </div>
              )}
              {people.length > 0 && (
                <div className="cp-agents">
                  {people.map((p) => (
                    <AgentRow
                      key={p.agentId}
                      agentId={p.agentId}
                      agent={agents.get(p.agentId)}
                      reason={p.reason}
                      score={p.score}
                      call={turn.calls.find((c) => c.agentId === p.agentId)}
                      onRefClick={onRefClick}
                    />
                  ))}
                </div>
              )}
            </Step>
          )}
          {show(2) && (
            <Step status={st.guard} title="등급 검사">
              {turn.guard && (
                <div className="cp-guard">
                  <span className="cp-guard-pill" data-status={turn.guard.status}>
                    {guardLabel}
                  </span>
                  {turn.guard.note && <span>{turn.guard.note}</span>}
                </div>
              )}
            </Step>
          )}
        </div>
      )}
    </div>
  );
}

function Turn({
  turn,
  assistant,
  agents,
  onRefClick,
  onRetry,
}: {
  turn: AssistantTurn;
  assistant: AgentView;
  agents: Map<string, AgentView>;
  onRefClick?: (r: RefLink) => void;
  onRetry?: () => void;
}) {
  const streaming = turn.status === "streaming";
  const refs = useMemo(() => {
    const m = new Map<string, RefLink>();
    for (const c of turn.calls) for (const r of c.refs) m.set(`${r.kind}:${r.id}`, r);
    return [...m.values()];
  }, [turn.calls]);
  const hasTrace = !!(turn.preface || turn.search || turn.calls.length || turn.guard);
  return (
    <div className="cp-turn">
      <Avatar agent={assistant} presence />
      <div className="cp-turn-body">
        <div className="cp-turn-name">
          <b>{assistant.name}</b>
          <span>{clock(turn.ts)}</span>
        </div>
        {hasTrace && <Trace turn={turn} agents={agents} onRefClick={onRefClick} />}
        {(turn.answer || (streaming && turn.phase === "answer")) && (
          <div className="cp-answer" aria-live="polite">
            <Markdown text={turn.answer} tail={streaming ? <span className="cp-caret" /> : null} />
          </div>
        )}
        {!streaming && refs.length > 0 && (
          <div className="cp-refs">
            {refs.map((r) => (
              <RefChip key={`${r.kind}:${r.id}`} r={r} onClick={onRefClick} />
            ))}
          </div>
        )}
        {!streaming && (
          <div className="cp-answer-foot" data-status={turn.status}>
            {turn.status === "done" && (
              <>
                <span>{seconds(turn.durationMs)}</span>
                {(turn.guard || turn.level) && <span>{gradeOf(turn.guard?.level ?? turn.level)} 등급 답변</span>}
                {turn.guard?.status === "redacted" && <span>{turn.guard.note}</span>}
              </>
            )}
            {turn.status === "stopped" && (
              <>
                <span>중지했습니다</span>
                {onRetry && (
                  <button type="button" className="cp-link-btn" onClick={onRetry}>
                    다시 물어보기
                  </button>
                )}
              </>
            )}
            {turn.status === "error" && (
              <>
                <span>답변하지 못했습니다{turn.error ? `: ${turn.error}` : ""}</span>
                {onRetry && (
                  <button type="button" className="cp-link-btn" onClick={onRetry}>
                    다시 시도
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({
  assistantName,
  busy,
  onSend,
  onStop,
  note,
  disabledReason,
}: {
  assistantName: string;
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  note?: string;
  /** 입력을 막는 까닭(만드는 중인 에이전트 등) */
  disabledReason?: string;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  };
  useEffect(fit, [text]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== w) {
        w = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const submit = () => {
    if (!text.trim() || busy || disabledReason) return;
    onSend(text);
    setText("");
  };
  return (
    <div className="cp-composer">
      <div className="cp-composer-inner">
        <div className="cp-box">
          <label htmlFor={id} className="sr-only">
            {assistantName}에게 물어보기
          </label>
          <textarea
            id={id}
            ref={ref}
            rows={1}
            value={text}
            placeholder={disabledReason ?? `${assistantName}에게 물어보기`}
            disabled={!!disabledReason}
            data-chat-input
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="cp-box-tools">
            <button type="button" className="cp-icon-btn cp-icon-btn-round" aria-label="안건 붙이기">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              type="button"
              className="cp-icon-btn"
              aria-label="언급"
              onClick={() => {
                setText((t) => (t.endsWith("@") ? t : `${t}@`));
                ref.current?.focus();
              }}
            >
              @
            </button>
            <span className="cp-kbd">Enter 보내기 · Shift Enter 줄바꿈</span>
            {busy ? (
              <button type="button" className="cp-stop" onClick={onStop}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
                중지
              </button>
            ) : (
              <button
                type="button"
                className="cp-send"
                aria-label="보내기"
                disabled={!text.trim() || !!disabledReason}
                onClick={submit}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4 4l17 8-17 8 3-8-3-8z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {note && <div className="cp-note">{note}</div>}
      </div>
    </div>
  );
}

/* ---------- 대화창 ---------- */

export interface ChatPaneProps {
  assistant: AgentView;
  agents: AgentView[];
  /** 이 대화창의 대화 id */
  conversationId: string;
  runQuery: RunQuery;
  initialMessages?: ChatMessage[];
  suggestions?: string[];
  disclosureNote?: string;
  onRefClick?: (r: RefLink) => void;
  onNewChat?: () => void;
  subtitle?: string;
  authenticated?: boolean;
  role?: Role;
  onRoleChange?: (r: Role) => void;
  focusAgentId?: string;
  onMessagesChange?: (m: ChatMessage[]) => void;
}

export function ChatPane(props: ChatPaneProps) {
  const {
    assistant,
    agents,
    runQuery,
    initialMessages,
    suggestions = [],
    disclosureNote,
    onRefClick,
    onNewChat,
    subtitle,
    authenticated = true,
    role = "owner",
    onRoleChange,
    focusAgentId,
    onMessagesChange,
    conversationId,
  } = props;
  const { messages, busy, send, stop, reset } = useChat(runQuery, initialMessages, {
    role,
    agentId: focusAgentId,
    conversationId,
  });

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const taskCount = agents.filter((a) => a.kind === "task").length;
  const focus = focusAgentId ? byId.get(focusAgentId) : undefined;
  const picks = focus ? (focus.suggestions ?? []) : suggestions;
  const blocked = focus?.status === "applying" ? `${focus.name}는 아직 만드는 중입니다` : undefined;

  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.text;

  return (
    <div className="cp-root">
      <header className="cp-head">
        <Avatar agent={focus ?? assistant} presence={focus ? focus.status !== "stopped" : true} />
        <div className="cp-head-title">
          <h1>{focus ? focus.name : assistant.name}</h1>
          <span>
            {subtitle ??
              (focus
                ? [focus.status && STATUS_LABEL[focus.status], focus.taskName, `${assistant.name}를 통해 대화`]
                    .filter(Boolean)
                    .join(" · ")
                : `대화 가능 · 담당자 ${taskCount}명을 관장`)}
          </span>
        </div>
        {(!authenticated || onRoleChange) && (
          <RoleSwitch authenticated={authenticated} role={role} onChange={onRoleChange} />
        )}
        <button type="button" className="cp-btn" onClick={() => (onNewChat ? onNewChat() : reset())} aria-label="새 대화">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16v4z" />
          </svg>
          <span className="cp-btn-label">새 대화</span>
        </button>
      </header>
      <div className="cp-scroll" ref={scroller}>
        <div className="cp-thread">
          {messages.length === 0 ? (
            <div className="cp-empty">
              {focus ? (
                <>
                  <div className="cp-profile">
                    <Avatar agent={focus} size="lg" presence={focus.status !== "stopped"} />
                    <div className="cp-profile-body">
                      <h2>{focus.name}</h2>
                      {focus.description && <p>{focus.description}</p>}
                      <div className="cp-profile-meta">
                        {focus.taskName && <span>{focus.taskName}</span>}
                        {focus.status && <span data-status={focus.status}>{STATUS_LABEL[focus.status]}</span>}
                        {focus.itemCount != null && <span>맡은 안건 {focus.itemCount}건</span>}
                        {focus.tags?.map((t) => (
                          <span key={t} className="cp-tag">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="cp-profile-note">
                    질문은 {assistant.name}가 받아 {focus.name}에게 확인한 뒤 답합니다.
                  </p>
                </>
              ) : (
                <>
                  <h2>무엇을 확인해 드릴까요?</h2>
                  <p>
                    {assistant.name}가 질문에 맞는 담당자를 찾아 확인한 뒤 답합니다. 담당자에게 무엇을 물었고 어떤 답을
                    받았는지 과정이 그대로 보입니다.
                  </p>
                </>
              )}
              {picks.length > 0 && (
                <div className="cp-suggest">
                  {picks.map((s) => (
                    <button key={s} type="button" disabled={!!blocked} onClick={() => send(s)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <line x1="16.5" y1="16.5" x2="21" y2="21" />
                      </svg>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="cp-msg-user">
                  <div>{m.text}</div>
                </div>
              ) : (
                <Turn
                  key={m.id}
                  turn={m}
                  assistant={assistant}
                  agents={byId}
                  onRefClick={onRefClick}
                  onRetry={lastQuestion && !busy ? () => send(lastQuestion) : undefined}
                />
              ),
            )
          )}
        </div>
      </div>
      <Composer
        assistantName={assistant.name}
        busy={busy}
        onSend={send}
        onStop={stop}
        note={disclosureNote}
        disabledReason={blocked}
      />
    </div>
  );
}

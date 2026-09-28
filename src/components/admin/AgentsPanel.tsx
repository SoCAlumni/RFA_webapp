"use client";

import { AgentIcon, IconLink, IconPlus } from "@/components/icons";
import { hasHangul } from "@/components/inbox/parts";
import { Modal } from "@/components/Modal";
import { errorText } from "@/lib/api";
import type { AdminAgent, AdminAgentDetail, AdminStatus, PromptView, TaskView } from "@/lib/api/types";
import { dayTime, fmtNum } from "@/lib/format";
import { useApp } from "@/store/app-store";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SourcesPanel } from "./SourcesPanel";

export const ADMIN_STATUS: Record<AdminStatus, { label: string; tone: string }> = {
  running: { label: "실행 중", tone: "ok" },
  stopped: { label: "꺼짐", tone: "mute" },
  applying: { label: "만드는 중", tone: "info" },
};

function StatusPill({ status, observed }: { status: AdminStatus; observed: boolean }) {
  const s = ADMIN_STATUS[status] ?? ADMIN_STATUS.stopped;
  return (
    <span
      className="pill"
      data-tone={s.tone}
      data-unobserved={!observed || undefined}
      title={observed ? undefined : "상태를 아직 확인하지 못해 선언된 값을 보여 줍니다"}
    >
      {s.label}
    </span>
  );
}

function AgentAvatar({ agent }: { agent: AdminAgent }) {
  return (
    <div className="avatar">
      <div
        className="avatar-face"
        data-hangul={hasHangul(agent.initials) || undefined}
        style={{ background: agent.color.bg, color: agent.color.fg }}
      >
        {agent.initials}
      </div>
      <div className="avatar-badge" style={{ background: agent.color.fg }}>
        <AgentIcon name={agent.icon} size={11} stroke={2.4} />
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  text,
  confirm,
  onConfirm,
  onClose,
}: {
  title: string;
  text: string;
  confirm: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal label={title} className="rfa-dialog rfa-dialog-sm" onClose={onClose}>
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="rfa-actions">
        <button type="button" className="rfa-btn" data-autofocus onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="rfa-btn rfa-btn-primary"
          style={{ background: "#8a2410", borderColor: "#8a2410" }}
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          {confirm}
        </button>
      </div>
    </Modal>
  );
}

/** 시스템 프롬프트: IDENTITY · SKILL 은 읽기 전용, instructions 만 고친다 */
function PromptDialog({ agent, canEdit, onClose }: { agent: AdminAgentDetail; canEdit: boolean; onClose: () => void }) {
  const { api, notify, loadAdminAgent } = useApp();
  const [view, setView] = useState<PromptView | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getPrompt(agent.id).then(
      (p) => {
        if (!alive) return;
        setView(p);
        setText(p.instructions);
      },
      (e) => {
        if (alive) setError(errorText(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [api, agent.id]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const r = await api.setPrompt(agent.id, text);
      notify(r.note || "다음 대화부터 적용됩니다");
      loadAdminAgent(agent.id);
      onClose();
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  };

  return (
    <Modal label="시스템 프롬프트" className="rfa-dialog pd" onClose={onClose}>
      <h2>시스템 프롬프트</h2>
      <p>
        <b>{agent.name}</b>가 매 대화 앞에 읽는 지시문입니다. IDENTITY · SKILL 은 읽기 전용이고, 덧붙일 지시만 고칠 수
        있습니다. 저장하면 다음 대화부터 적용됩니다.
      </p>
      {!view && !error && (
        <div className="loading" style={{ height: 120 }}>
          <span className="spin" aria-hidden="true" />
          불러오는 중
        </div>
      )}
      {view && (
        <div className="pd-body">
          <details>
            <summary>IDENTITY</summary>
            <pre>{view.identity}</pre>
          </details>
          {view.skill && (
            <details>
              <summary>SKILL · {view.skill}</summary>
              <pre>{view.skillText}</pre>
            </details>
          )}
          <label className="rfa-field">
            <span>
              덧붙일 지시{" "}
              <small className="rfa-hint">
                {text.length} / 4000자
                {view.instructionsUpdatedAt ? ` · 마지막 저장 ${dayTime(view.instructionsUpdatedAt)}` : ""}
              </small>
            </span>
            <textarea
              className="mono"
              rows={7}
              maxLength={4000}
              value={text}
              readOnly={!canEdit}
              data-autofocus
              placeholder={canEdit ? "예: 답변 끝에 근거 문서 이름을 붙인다." : "이 에이전트는 고칠 수 없습니다."}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
              }}
            />
          </label>
        </div>
      )}
      {error && (
        <p className="rfa-error" role="alert">
          {error}
        </p>
      )}
      <div className="rfa-actions" style={{ marginTop: 14 }}>
        <button type="button" className="rfa-btn" onClick={onClose}>
          {canEdit ? "취소" : "닫기"}
        </button>
        {canEdit && (
          <button
            type="button"
            className="rfa-btn rfa-btn-primary"
            disabled={!view || saving || text === view.instructions}
            onClick={save}
          >
            {saving && <span className="spin" aria-hidden="true" />}
            {saving ? "적용하는 중" : "저장"}
          </button>
        )}
      </div>
    </Modal>
  );
}

const PARTS = [
  { key: "systemPrompt", label: "시스템 프롬프트", color: "#2a78d6" },
  { key: "toolDefinitions", label: "도구 정의", color: "#eb6834" },
  { key: "memoryNotes", label: "기억과 노트", color: "#1baf7a" },
  { key: "conversation", label: "대화 기록", color: "#eda100" },
] as const;

function ContextCard({ agent }: { agent: AdminAgentDetail }) {
  const { agentAction } = useApp();
  const [busy, setBusy] = useState<"compact" | "clear-memory" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const c = agent.context;
  const run = async (action: "compact" | "clear-memory") => {
    setBusy(action);
    await agentAction(agent.id, action);
    setBusy(null);
  };
  const pct = (v: number) => (c ? `${Math.min(100, (v / c.limitTokens) * 100).toFixed(1)}%` : "0%");
  return (
    <section className="adm-card" aria-label="컨텍스트">
      <div className="adm-card-head">
        <h3>컨텍스트</h3>
        <span>
          {c
            ? `압축 방식 ${c.compaction ?? "safeguard"} · 최근 ${c.preserveRecentTurns ?? 1}턴 보존${c.measured ? " · 합계 실측" : " · 추정"}`
            : "아직 LLM 호출 기록이 없습니다"}
        </span>
      </div>
      {c && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="ctx-now">
            <span>지금 쓰는 양{c.measuredAt ? ` · ${dayTime(c.measuredAt)} 기준` : ""}</span>
            <span>
              <b>{fmtNum(c.usedTokens)}</b> / {fmtNum(c.limitTokens)} 토큰
            </span>
          </div>
          <div
            className="ctx-bar"
            role="img"
            aria-label={`컨텍스트 ${fmtNum(c.limitTokens)} 토큰 중 ${fmtNum(c.usedTokens)} 토큰 사용. ${PARTS.map(
              (p) => `${p.label} ${fmtNum(c.breakdown[p.key])}`,
            ).join(", ")}`}
          >
            {PARTS.map((p) => (
              <div
                key={p.key}
                title={`${p.label} · ${fmtNum(c.breakdown[p.key])} 토큰`}
                style={{ width: pct(c.breakdown[p.key]), background: p.color }}
              />
            ))}
            <div
              title={`남은 공간 · ${fmtNum(Math.max(0, c.limitTokens - c.usedTokens))} 토큰`}
              style={{ flexGrow: 1, background: "#e6e8ee" }}
            />
          </div>
          <div className="ctx-legend">
            {PARTS.map((p) => (
              <div key={p.key}>
                <i style={{ background: p.color }} />
                <span>{p.label}</span>
                <b>{fmtNum(c.breakdown[p.key])}</b>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="adm-actions">
        <button
          type="button"
          className="adm-btn"
          title="최근에 이어 쓰는 대화를 LLM으로 요약해 컨텍스트를 줄입니다. 최근 턴은 그대로 두고 기록은 지우지 않습니다."
          disabled={!agent.actions.compact || !!busy}
          onClick={() => run("compact")}
        >
          {busy === "compact" && <span className="spin" aria-hidden="true" />}
          {busy === "compact" ? "요약해 압축하는 중" : "대화 압축"}
        </button>
        <button
          type="button"
          className="adm-btn"
          data-danger
          disabled={!agent.actions.clearMemory || !!busy}
          onClick={() => setConfirm(true)}
        >
          {busy === "clear-memory" && <span className="spin" aria-hidden="true" />}
          {busy === "clear-memory" ? "비우는 중" : "기억 비우기"}
        </button>
        <div className="grow" />
        <button type="button" className="adm-textlink" data-keep onClick={() => setPrompt(true)}>
          {agent.actions.editPrompt ? "시스템 프롬프트 편집" : "시스템 프롬프트 보기"}
        </button>
      </div>
      {confirm && (
        <ConfirmDialog
          title="기억을 비울까요?"
          text={`${agent.name}의 세션과 MEMORY.md 를 지웁니다. 되돌릴 수 없습니다.`}
          confirm="비우기"
          onConfirm={() => run("clear-memory")}
          onClose={() => setConfirm(false)}
        />
      )}
      {prompt && <PromptDialog agent={agent} canEdit={agent.actions.editPrompt} onClose={() => setPrompt(false)} />}
    </section>
  );
}

function LoadedSourcesCard({ agent }: { agent: AdminAgentDetail }) {
  const { toggleLoadedSource } = useApp();
  const [pending, setPending] = useState<string | null>(null);
  if (!agent.sources.length) return null;
  return (
    <section className="adm-card" aria-label="불러오는 자료">
      <div className="adm-card-head">
        <h3>불러오는 자료</h3>
        <span>답할 때 찾아보는 사내 지식 · 끈 자료는 조회 자체를 막습니다</span>
      </div>
      <ul className="ls-list">
        {agent.sources.map((s) => {
          const disabled = !agent.actions.toggleSources || !s.available || !!pending;
          return (
            <li key={s.id}>
              <div>
                <b>{s.title}</b>
                <span>{s.available ? s.description : (s.unavailableReason ?? "지금은 쓸 수 없습니다")}</span>
              </div>
              {pending === s.id && <span className="spin" aria-hidden="true" />}
              <button
                type="button"
                role="switch"
                className="ls-switch"
                aria-checked={s.enabled}
                aria-label={`${s.title} ${s.enabled ? "끄기" : "켜기"}`}
                disabled={disabled}
                onClick={async () => {
                  setPending(s.id);
                  await toggleLoadedSource(agent.id, s.id, !s.enabled);
                  setPending(null);
                }}
              >
                <i />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StatsCard({ agent }: { agent: AdminAgentDetail }) {
  const s = agent.stats;
  const days = s.last7Days.slice(-7);
  const max = Math.max(4, ...days.map((d) => d.calls));
  const top = max <= 10 ? Math.ceil(max / 2) * 2 : Math.ceil(max / 20) * 20;
  const h = (v: number) => Math.round((v / top) * 108);
  const last = days[days.length - 1]?.day;
  const label = (day: string) => {
    const [, m, d] = day.split("-");
    return day === last ? "오늘" : `${Number(m)}/${Number(d)}`;
  };
  const cols = { gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))` };
  return (
    <section className="adm-card" aria-label="호출 통계">
      <div className="adm-card-head">
        <h3>호출 통계</h3>
        <span>
          오늘 · {s.provider} · {s.model}
        </span>
      </div>
      <div className="stat-grid">
        <div>
          <span>추론 호출</span>
          <b>
            {fmtNum(s.calls)}
            <small> 회</small>
          </b>
        </div>
        <div>
          <span>쓴 토큰</span>
          <b>
            {s.tokensThousands}
            <small> 천</small>
          </b>
        </div>
        <div>
          <span>평균 응답</span>
          <b>
            {s.avgLatencySeconds.toFixed(1)}
            <small> 초</small>
          </b>
        </div>
        <div>
          <span>차단된 호출</span>
          <b>
            {s.blockedCalls}
            <small> 건</small>
          </b>
        </div>
      </div>
      {days.length > 0 && (
        <div className="chart">
          <div className="chart-title">최근 7일 추론 호출</div>
          <div className="chart-grid">
            <div className="chart-y">
              <span style={{ top: -8 }}>{top}</span>
              <span style={{ top: 49 }}>{top / 2}</span>
              <span style={{ top: 106 }}>0</span>
            </div>
            <div
              className="chart-plot"
              role="img"
              aria-label={`최근 7일 추론 호출. ${days.map((d) => `${d.day} ${d.calls}회`).join(", ")}`}
            >
              <div className="chart-mid" />
              <div className="chart-bars" style={cols}>
                {days.map((d, i) => (
                  <div key={d.day} title={`${d.day} · ${d.calls}회`} style={{ height: Math.max(h(d.calls), d.calls ? 2 : 0) }}>
                    {i === days.length - 1 && <span>{d.calls}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div />
            <div className="chart-x" style={cols}>
              {days.map((d) => (
                <span key={d.day}>{label(d.day)}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** 만든 태스크(팀)의 supervisor 에서만: 태스크와 팀 에이전트를 지운다. 기본 태스크는 지울 수 없다 */
function DeleteTaskCard({ task }: { task: TaskView }) {
  const { deleteTask } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const run = async () => {
    setBusy(true);
    const r = await deleteTask(task.id);
    setBusy(false);
    if (!r) return;
    // 관리 창 아래에 지운 태스크의 결재함이나 그 에이전트와의 대화가 열려 있었다면 옮겨 둔다
    const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if ((parts[0] === "inbox" && parts[1] === task.id) || (parts[0] === "chat" && parts[1] === task.agentId))
      router.replace(parts[0] === "inbox" ? "/inbox" : "/chat");
  };
  return (
    <section className="adm-card" aria-label="태스크 삭제">
      <div className="adm-card-head">
        <h3>태스크 삭제</h3>
        <span>결재·대화 기록은 남습니다</span>
      </div>
      <div className="adm-actions">
        <span className="rfa-hint">
          「{task.name}」 태스크와 팀 에이전트를 샌드박스에서 내리고, 연결한 소스도 지웁니다.
        </span>
        <div className="grow" />
        <button type="button" className="adm-btn" data-danger disabled={busy} onClick={() => setConfirm(true)}>
          {busy && <span className="spin" aria-hidden="true" />}
          {busy ? "삭제하는 중" : "태스크 삭제"}
        </button>
      </div>
      {confirm && (
        <ConfirmDialog
          title="태스크를 삭제할까요?"
          text={`「${task.name}」 태스크와 ${task.agentName}(팀 에이전트 전체)를 지웁니다. 연결한 소스와 에이전트 설정도 함께 지워지며 되돌릴 수 없습니다. 결재·대화 기록은 남습니다.`}
          confirm="삭제"
          onConfirm={run}
          onClose={() => setConfirm(false)}
        />
      )}
    </section>
  );
}

function AgentDetailView({ id }: { id: string }) {
  const { adminDetails, loadAdminAgent, openAdmin, adminList, data } = useApp();
  const d = adminDetails[id];
  const summary = adminList?.agents.find((a) => a.id === id);
  useEffect(() => {
    loadAdminAgent(id);
  }, [id, loadAdminAgent]);
  const head = d ?? summary;
  if (!head)
    return (
      <div className="loading">
        <span className="spin" aria-hidden="true" />
        불러오는 중
      </div>
    );
  const readOnly = data?.me.role !== "owner";
  const taskIds = head.tasks?.map((t) => t.id) ?? [];
  // 만든 태스크는 그 팀의 supervisor 화면에서 지운다(owner 만)
  const ownTeamTask = readOnly ? undefined : data?.tasks.find((t) => t.source === "team" && t.worker === id);
  return (
    <>
      <div className="detail-bar">
        <span>에이전트</span>
        <span className="detail-bar-sep">/</span>
        <span className="mono">{head.name}</span>
        <div className="grow" />
        {head.sandbox && (
          <button type="button" className="link-btn" data-keep onClick={() => openAdmin("sandbox", head.sandbox!)}>
            <IconLink />
            <span>{head.sandbox} 샌드박스 설정 보기</span>
          </button>
        )}
      </div>
      <div className="adm-body">
        <div className="adm-hero">
          <div className="adm-hero-face" style={{ background: head.color.bg, color: head.color.fg }}>
            {head.initials}
          </div>
          <div>
            <h2>{head.name}</h2>
            <span>{d?.description || head.subtitle}</span>
          </div>
          <StatusPill status={head.status} observed={head.observed} />
        </div>
        {!head.editable && head.readOnlyReason && <p className="adm-readonly">{head.readOnlyReason}</p>}
        {taskIds.length ? (
          taskIds.map((t) => <SourcesPanel key={`${id}:${t}`} taskId={t} readOnly={readOnly || !head.editable} />)
        ) : (
          <SourcesPanel key={id} />
        )}
        {d ? (
          <>
            <ContextCard agent={d} />
            <LoadedSourcesCard agent={d} />
            <StatsCard agent={d} />
            {ownTeamTask && <DeleteTaskCard key={ownTeamTask.id} task={ownTeamTask} />}
          </>
        ) : (
          <div className="loading" style={{ height: 160 }}>
            <span className="spin" aria-hidden="true" />
            상세를 불러오는 중
          </div>
        )}
      </div>
    </>
  );
}

export function AgentsPanel() {
  const { admin, adminList, selectAdminAgent, requestAddTask, clearAgentFilter } = useApp();
  if (!adminList)
    return (
      <div className="loading">
        <span className="spin" aria-hidden="true" />
        에이전트를 불러오는 중
      </div>
    );
  // 서버가 정렬해 준다(태스크 담당 → 팀 supervisor 와 멤버 → 나머지 → 관리). 다시 정렬하지 않는다
  const all = adminList.agents;
  const list = admin.filter ? all.filter((a) => admin.filter!.ids.includes(a.id)) : all;
  const selected = all.find((a) => a.id === admin.agentId) ?? list[0];

  return (
    <div className="adm-grid">
      <section className="adm-list" aria-label="에이전트 목록">
        <div className="adm-list-head">
          <div>
            <h1>에이전트</h1>
            <span>
              태스크 {adminList.counts.task} · 관리 {adminList.counts.management}
            </span>
          </div>
          <button type="button" className="adm-add" data-keep onClick={requestAddTask}>
            <IconPlus size={14} />
            <span>추가</span>
          </button>
        </div>
        {admin.filter && (
          <div className="adm-filter">
            <span>{admin.filter.label}</span>
            <button type="button" data-keep onClick={clearAgentFilter}>
              모두 보기
            </button>
          </div>
        )}
        <div>
          {list.map((a, i) => {
            const groupStart = i === 0 || list[i - 1].group !== a.group;
            return (
              <div key={a.id}>
                {groupStart && (
                  <div className="adm-group">{a.group === "management" ? "관리 에이전트" : "태스크 에이전트"}</div>
                )}
                <button
                  type="button"
                  data-keep
                  className="adm-row"
                  data-member={a.role === "member" || undefined}
                  aria-current={a.id === selected?.id}
                  onClick={() => selectAdminAgent(a.id)}
                >
                  <AgentAvatar agent={a} />
                  <div className="adm-row-text">
                    <b>{a.name}</b>
                    <span>{a.subtitle}</span>
                    <span>{a.sandboxLine}</span>
                  </div>
                  <div className="adm-row-side">
                    <StatusPill status={a.status} observed={a.observed} />
                    <span>오늘 {a.callsToday}회</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
        {adminList.hint && <div className="adm-note">{adminList.hint}</div>}
      </section>
      <main className="adm-main">{selected ? <AgentDetailView id={selected.id} /> : null}</main>
    </div>
  );
}

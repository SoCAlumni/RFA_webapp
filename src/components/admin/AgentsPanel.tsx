"use client";

import { AgentIcon, IconLink, IconPlus, IconShieldSmall, IconStarFill } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { hasHangul } from "@/components/inbox/parts";
import { ApiError } from "@/lib/api";
import type { AdminAgent, AgentStatus } from "@/lib/api/types";
import { useApp, useData } from "@/store/app-store";
import { useState } from "react";
import { SourcesPanel } from "./SourcesPanel";

const fmt = (n: number) => n.toLocaleString("ko-KR");

export const AGENT_STATUS: Record<AgentStatus, { label: string; tone: string }> = {
  running: { label: "실행 중", tone: "ok" },
  waiting_decision: { label: "결정 대기", tone: "warn" },
  stopped: { label: "꺼짐", tone: "mute" },
};

function Badge({ agent }: { agent: AdminAgent }) {
  const icon = agent.badge.icon;
  return (
    <div className="avatar-badge" style={{ background: agent.badge.bg }}>
      {icon === "star-fill" ? (
        <IconStarFill />
      ) : icon === "shield" ? (
        <IconShieldSmall />
      ) : (
        <AgentIcon name={icon} size={11} stroke={2.4} />
      )}
    </div>
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
      <Badge agent={agent} />
    </div>
  );
}

function SystemPromptDialog({ agent, onClose }: { agent: AdminAgent; onClose: () => void }) {
  const { updateSystemPrompt } = useApp();
  const [text, setText] = useState(agent.systemPrompt);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Modal label="시스템 프롬프트 편집" className="rfa-dialog" onClose={onClose}>
      <h2>시스템 프롬프트 편집</h2>
      <p>
        <b>{agent.short}</b> 에이전트가 매 대화 앞에 읽는 지시문입니다. 저장하면 다음 호출부터 적용됩니다.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return setError("비워 둘 수 없습니다.");
          setSaving(true);
          try {
            await updateSystemPrompt(agent.id, text.trim());
            onClose();
          } catch (err) {
            setError(err instanceof ApiError || err instanceof Error ? err.message : String(err));
            setSaving(false);
          }
        }}
      >
        <label className="rfa-field">
          <span>지시문</span>
          <textarea
            className="mono"
            rows={8}
            maxLength={4000}
            value={text}
            data-autofocus
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
          />
        </label>
        {error && (
          <p className="rfa-error" role="alert">
            {error}
          </p>
        )}
        <div className="rfa-actions">
          <button type="button" className="rfa-btn" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="rfa-btn rfa-btn-primary" disabled={saving}>
            {saving ? "저장하는 중" : "저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ContextCard({ agent, readOnly }: { agent: AdminAgent; readOnly: boolean }) {
  const { compactContext, clearMemory } = useApp();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"compact" | "clear" | null>(null);
  const c = agent.context;
  const used = c.system + c.tools + c.memory + c.history;
  const parts = [
    { key: "system", label: "시스템 프롬프트", value: c.system, color: "#2a78d6" },
    { key: "tools", label: "도구 정의", value: c.tools, color: "#eb6834" },
    { key: "memory", label: "기억과 노트", value: c.memory, color: "#1baf7a" },
    { key: "history", label: "대화 기록", value: c.history, color: "#eda100" },
  ];
  const pct = (v: number) => `${((v / c.limit) * 100).toFixed(1)}%`;
  const run = async (kind: "compact" | "clear") => {
    setBusy(kind);
    await (kind === "compact" ? compactContext(agent.id) : clearMemory(agent.id));
    setBusy(null);
  };
  return (
    <section className="adm-card" aria-label="컨텍스트">
      <div className="adm-card-head">
        <h3>컨텍스트</h3>
        <span>압축 방식 safeguard · 최근 1턴 보존</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="ctx-now">
          <span>지금 쓰는 양</span>
          <span>
            <b>{fmt(used)}</b> / {fmt(c.limit)} 토큰
          </span>
        </div>
        <div
          className="ctx-bar"
          role="img"
          aria-label={`컨텍스트 ${fmt(c.limit)} 토큰 중 ${fmt(used)} 토큰 사용. ${parts
            .map((p) => `${p.label} ${fmt(p.value)}`)
            .join(", ")}`}
        >
          {parts.map((p) => (
            <div key={p.key} title={`${p.label} · ${fmt(p.value)} 토큰`} style={{ width: pct(p.value), background: p.color }} />
          ))}
          <div title={`남은 공간 · ${fmt(c.limit - used)} 토큰`} style={{ flexGrow: 1, background: "#e6e8ee" }} />
        </div>
        <div className="ctx-legend">
          {parts.map((p) => (
            <div key={p.key}>
              <i style={{ background: p.color }} />
              <span>{p.label}</span>
              <b>{fmt(p.value)}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="adm-actions">
        <button type="button" className="adm-btn" disabled={readOnly || !!busy || c.history === 0} onClick={() => run("compact")}>
          {busy === "compact" && <span className="spin" aria-hidden="true" />}
          대화 압축
        </button>
        <button
          type="button"
          className="adm-btn"
          data-danger
          disabled={readOnly || !!busy || c.memory === 0}
          onClick={() => run("clear")}
        >
          {busy === "clear" && <span className="spin" aria-hidden="true" />}
          기억 비우기
        </button>
        <div className="grow" />
        <button type="button" className="adm-textlink" disabled={readOnly} onClick={() => setEditing(true)}>
          시스템 프롬프트 편집
        </button>
      </div>
      {editing && <SystemPromptDialog agent={agent} onClose={() => setEditing(false)} />}
    </section>
  );
}

function StatsCard({ agent, model }: { agent: AdminAgent; model: string }) {
  const s = agent.stats;
  const max = Math.max(40, ...s.week.map((d) => d.value));
  const top = Math.ceil(max / 20) * 20;
  const h = (v: number) => Math.round((v / top) * 108);
  return (
    <section className="adm-card" aria-label="호출 통계">
      <div className="adm-card-head">
        <h3>호출 통계</h3>
        <span>오늘 · LLM API Endpoints · {model}</span>
      </div>
      <div className="stat-grid">
        <div>
          <span>추론 호출</span>
          <b>
            {s.calls}
            <small> 회</small>
          </b>
        </div>
        <div>
          <span>쓴 토큰</span>
          <b>
            {s.tokensK}
            <small> 천</small>
          </b>
        </div>
        <div>
          <span>평균 응답</span>
          <b>
            {s.avgSec.toFixed(1)}
            <small> 초</small>
          </b>
        </div>
        <div>
          <span>차단된 호출</span>
          <b>
            {s.blocked}
            <small> 건</small>
          </b>
        </div>
      </div>
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
            aria-label={`최근 7일 추론 호출. ${s.week.map((d) => `${d.date} ${d.value}회`).join(", ")}`}
          >
            <div className="chart-mid" />
            <div className="chart-bars">
              {s.week.map((d, i) => (
                <div key={i} title={`${d.date} · ${d.value}회`} style={{ height: Math.max(h(d.value), d.value ? 2 : 0) }}>
                  {i === s.week.length - 1 && <span>{d.value}</span>}
                </div>
              ))}
            </div>
          </div>
          <div />
          <div className="chart-x">
            {s.week.map((d, i) => (
              <span key={i}>{d.label}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AgentsPanel() {
  const { adminAgents, sandboxes, session } = useData();
  const { admin, selectAdminAgent, openAdmin, requestAddTask } = useApp();
  const readOnly = session.role !== "owner";
  const agent = adminAgents.find((a) => a.id === admin.agentId) ?? adminAgents[0];
  const status = AGENT_STATUS[agent.status];
  const model = sandboxes.find((s) => s.id === agent.sandbox)?.model ?? "qwen3.5:9b";

  return (
    <div className="adm-grid">
      <section className="adm-list" aria-label="에이전트 목록">
        <div className="adm-list-head">
          <div>
            <h1>에이전트</h1>
            <span>통합 관리자 하나와 태스크별 업무 에이전트</span>
          </div>
          <button type="button" className="adm-add" data-keep onClick={requestAddTask}>
            <IconPlus size={14} />
            <span>추가</span>
          </button>
        </div>
        <div>
          {adminAgents.map((a) => {
            const st = AGENT_STATUS[a.status];
            return (
              <button
                key={a.id}
                type="button"
                data-keep
                className="adm-row"
                aria-current={a.id === agent.id}
                onClick={() => selectAdminAgent(a.id)}
              >
                <AgentAvatar agent={a} />
                <div className="adm-row-text">
                  <b>{a.short}</b>
                  <span>{a.subtitle}</span>
                  <span>{a.sandbox} 샌드박스</span>
                </div>
                <div className="adm-row-side">
                  <span className="pill" data-tone={st.tone}>
                    {st.label}
                  </span>
                  <span>오늘 {a.callsToday}회</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <main className="adm-main">
        <div className="detail-bar">
          <span>에이전트</span>
          <span className="detail-bar-sep">/</span>
          <span className="mono">{agent.short}</span>
          <div className="grow" />
          <button type="button" className="link-btn" data-keep onClick={() => openAdmin("sandbox", agent.sandbox)}>
            <IconLink />
            <span>{agent.sandbox} 샌드박스 설정 보기</span>
          </button>
        </div>
        <div className="adm-body">
          <div className="adm-hero">
            <div className="adm-hero-face" style={{ background: agent.color.bg, color: agent.color.fg }}>
              {agent.initials}
            </div>
            <div>
              <h2>{agent.short}</h2>
              <span>{agent.description}</span>
            </div>
            <span className="pill" data-tone={status.tone}>
              {status.label}
            </span>
          </div>
          <SourcesPanel key={agent.id} taskId={agent.taskId} readOnly={readOnly} />
          <ContextCard agent={agent} readOnly={readOnly} />
          <StatsCard agent={agent} model={model} />
        </div>
      </main>
    </div>
  );
}


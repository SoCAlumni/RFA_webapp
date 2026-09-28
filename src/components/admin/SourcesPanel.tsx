"use client";

import { errorText } from "@/lib/api";
import type { SandboxLevel, SourceKind } from "@/lib/api/types";
import { dayTime } from "@/lib/format";
import { useApp } from "@/store/app-store";
import { useEffect, useState } from "react";

const GithubMark = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" />
  </svg>
);
const SlackMark = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
  </svg>
);
const Cross = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const Plus = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const SCOPES: Record<SourceKind, string[]> = {
  github: ["이슈", "PR 코멘트", "Discussions"],
  slack: ["멘션", "모든 메시지", "DM"],
};
const GRADE_LABEL: Record<SandboxLevel, string> = { public: "사외", company: "사내" };

function AddSourceForm({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const { addSource } = useApp();
  const [kind, setKind] = useState<SourceKind>("github");
  const [target, setTarget] = useState("");
  const [scopes, setScopes] = useState<string[]>(["이슈"]);
  const [grade, setGrade] = useState<SandboxLevel>("public");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const changeKind = (k: SourceKind) => {
    setKind(k);
    setScopes(k === "github" ? ["이슈"] : ["멘션"]);
    setGrade(k === "github" ? "public" : "company");
    setTarget("");
    setError("");
  };

  const submit = async () => {
    const t = target.trim();
    // 서버와 같은 규칙으로 먼저 막는다(문구는 시안 그대로)
    const ok = kind === "github" ? /^[\w.-]+\/[\w.-]+$/.test(t) : /^(#[\w가-힣.-]+|DM · .+)$/.test(t);
    if (!ok) {
      setError(
        kind === "github"
          ? "저장소를 owner/repo 형태로 적어 주세요."
          : '채널은 #채널이름, DM은 "DM · 팀이름"으로 적어 주세요.',
      );
      return;
    }
    if (!scopes.length) {
      setError("받을 범위를 하나 이상 골라 주세요.");
      return;
    }
    setSaving(true);
    try {
      await addSource(taskId, { kind, target: t, scopes, grade });
      onDone();
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  };

  return (
    <div className="sp-form" role="group" aria-label="소스 추가">
      <div className="sp-seg" role="radiogroup" aria-label="소스 종류">
        {(["github", "slack"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => changeKind(k)}>
            {k === "github" ? GithubMark : SlackMark}
            {k === "github" ? "GitHub" : "Slack"}
          </button>
        ))}
      </div>
      <label className="sp-field">
        <span>{kind === "github" ? "저장소" : "채널 또는 DM"}</span>
        <input
          value={target}
          autoFocus
          maxLength={200}
          onChange={(e) => {
            setTarget(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
          placeholder={kind === "github" ? "owner/repo  예: team/ondevice-llm" : "#C0123ABC  또는  DM · 팀이름"}
        />
      </label>
      <div className="sp-field">
        <span>받을 범위</span>
        <div className="sp-checks">
          {SCOPES[kind].map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                checked={scopes.includes(s)}
                onChange={(e) => setScopes((v) => (e.target.checked ? [...v, s] : v.filter((x) => x !== s)))}
              />
              {s}
            </label>
          ))}
        </div>
      </div>
      <div className="sp-field">
        <span>들어오는 결재 대상의 기본 등급</span>
        <div className="sp-seg sp-seg-sm" role="radiogroup" aria-label="기본 등급">
          {(["public", "company"] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={grade === g}
              data-grade={GRADE_LABEL[g]}
              onClick={() => setGrade(g)}
            >
              {GRADE_LABEL[g]}
              {kind === "github" ? (g === "public" ? " · 공개 저장소" : " · 비공개 저장소") : ""}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="sp-err" role="alert">
          {error}
        </p>
      )}
      <div className="sp-form-actions">
        <button type="button" className="sp-btn" onClick={onDone}>
          취소
        </button>
        <button type="button" className="sp-btn sp-btn-primary" onClick={submit} disabled={saving}>
          {saving ? "연결하는 중" : "연결"}
        </button>
      </div>
    </div>
  );
}

/** 태스크 에이전트에 문의가 들어오는 곳(GitHub · Slack) — GET/POST/DELETE /tasks/{id}/sources */
/** taskName: 한 에이전트가 태스크를 여럿 맡으면 카드마다 어느 태스크의 소스인지 붙인다 */
export function SourcesPanel({
  taskId,
  taskName,
  readOnly,
}: {
  taskId?: string;
  taskName?: string;
  readOnly?: boolean;
}) {
  const { sources, loadSources, removeSource } = useApp();
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (taskId) loadSources(taskId);
  }, [taskId, loadSources]);

  if (!taskId)
    return (
      <section className="sp" aria-label="소스">
        <div className="sp-head">
          <h3>소스</h3>
        </div>
        <p className="sp-note">
          이 에이전트는 외부 소스를 직접 받지 않습니다. 태스크 에이전트를 고르면 GitHub · Slack 소스를 붙일 수 있어요.
        </p>
      </section>
    );

  const list = sources[taskId];
  return (
    <section className="sp" aria-label={taskName ? `소스 · ${taskName}` : "소스"}>
      <div className="sp-head">
        <div>
          <h3>{taskName ? `소스 · ${taskName}` : "소스"}</h3>
          <span>문의가 들어오는 곳 · {list ? list.length : "…"}개</span>
        </div>
        {!adding && !readOnly && (
          <button type="button" className="sp-btn" onClick={() => setAdding(true)}>
            {Plus}소스 추가
          </button>
        )}
      </div>
      {list && list.length === 0 && !adding && (
        <p className="sp-note">
          아직 연결된 소스가 없습니다. GitHub 저장소나 Slack 채널을 붙이면 여기로 들어온 문의가 이 에이전트의 결재 대상이
          됩니다.
        </p>
      )}
      {list && list.length > 0 && (
        <ul className="sp-list">
          {list.map((s) => (
            <li key={s.id} className="sp-item" data-kind={s.kind}>
              <span className="sp-icon" aria-hidden="true">
                {s.kind === "github" ? GithubMark : SlackMark}
              </span>
              <span className="sp-main">
                <b>{s.target}</b>
                <span>
                  {s.kindLabel} · {s.scopes.join(" · ")}
                  {s.requestCount ? ` · 요청 ${s.requestCount}건` : ""}
                  {s.lastRequestAt ? ` · 최근 ${dayTime(s.lastRequestAt)}` : ""}
                </span>
              </span>
              <span className="sp-grade" data-grade={s.gradeLabel}>
                {s.gradeLabel}
              </span>
              <span className="sp-state" data-status={s.status}>
                연결됨
              </span>
              {!readOnly && (
                <button
                  type="button"
                  className="sp-x"
                  aria-label={`${s.target} 소스 떼기`}
                  onClick={() => removeSource(taskId, s.id)}
                >
                  {Cross}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {adding && <AddSourceForm taskId={taskId} onDone={() => setAdding(false)} />}
    </section>
  );
}

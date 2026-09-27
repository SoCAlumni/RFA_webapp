"use client";

import { IconCheck, IconLink, IconPlus, IconWarn } from "@/components/icons";
import type { Sandbox, SandboxSettings } from "@/lib/api/types";
import { useApp, useData } from "@/store/app-store";
import { Fragment, useEffect, useState } from "react";

const settingsOf = (s: Sandbox): SandboxSettings => ({
  model: s.model,
  contextLength: s.contextLength,
  maxTokens: s.maxTokens,
  gateway: s.gateway,
});

const FIELD_LABEL: Record<keyof SandboxSettings, string> = {
  model: "모델",
  contextLength: "컨텍스트 길이",
  maxTokens: "최대 응답 길이",
  gateway: "게이트웨이",
};

export function SandboxPanel() {
  const { sandboxes, sandboxOptions: opts, adminAgents, session } = useData();
  const { admin, selectSandbox, openAdmin, setDialog, updateSandbox } = useApp();
  const readOnly = session.role !== "owner";
  const sb = sandboxes.find((s) => s.id === admin.sandboxId) ?? sandboxes[0];
  const [form, setForm] = useState<SandboxSettings>(settingsOf(sb));
  const [saving, setSaving] = useState(false);

  // 다른 샌드박스를 고르거나 적용이 끝나면 폼을 새 값으로 맞춘다
  useEffect(() => {
    setForm(settingsOf(sb));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb.id, sb.model, sb.contextLength, sb.maxTokens, sb.gateway]);

  const applied = settingsOf(sb);
  const dirty = (Object.keys(form) as (keyof SandboxSettings)[]).filter((k) => form[k] !== applied[k]);
  const agentCount = (id: string) => adminAgents.filter((a) => a.sandbox === id).length;
  const gateway = opts.gateways.find((g) => g.id === sb.gateway);
  const sharing = sandboxes.filter((s) => s.id !== sb.id && s.gateway === sb.gateway);

  const select = (
    id: string,
    key: keyof SandboxSettings,
    values: (string | number)[],
    label: (v: string | number) => string = String,
    mono = true,
  ) => (
    <div className="sb-field">
      <label htmlFor={id}>{FIELD_LABEL[key] === "게이트웨이" ? "연결할 게이트웨이" : FIELD_LABEL[key]}</label>
      <select
        id={id}
        className={mono ? "mono" : undefined}
        value={String(form[key])}
        data-dirty={dirty.includes(key) || undefined}
        onChange={(e) => {
          const raw = e.target.value;
          setForm((f) => ({ ...f, [key]: typeof applied[key] === "number" ? Number(raw) : raw }));
        }}
      >
        {values.map((v) => (
          <option key={v} value={String(v)}>
            {label(v)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="adm-grid">
      <section className="adm-list" aria-label="샌드박스 목록">
        <div className="adm-list-head">
          <div>
            <h1>샌드박스</h1>
            <span>기밀 등급마다 하나씩 둡니다</span>
          </div>
          <button type="button" className="adm-add" data-keep onClick={() => setDialog("addSandbox")}>
            <IconPlus size={14} />
            <span>추가</span>
          </button>
        </div>
        <div>
          {sandboxes.map((s) => {
            const off = s.status === "stopped";
            const gw = opts.gateways.find((g) => g.id === s.gateway);
            return (
              <button
                key={s.id}
                type="button"
                data-keep
                className="adm-row"
                aria-current={s.id === sb.id}
                onClick={() => selectSandbox(s.id)}
              >
                <div className="sq-face" style={{ background: s.color.bg, color: s.color.fg, marginTop: 2 }}>
                  {s.short}
                </div>
                <div className="adm-row-text">
                  <b className="mono" data-dim={off || undefined}>
                    {s.name}
                  </b>
                  <span data-dim={!s.taskLabels.length || undefined}>
                    {s.taskLabels.length ? s.taskLabels.join(", ") : "연결된 태스크 없음"}
                  </span>
                  <span>LLM API Endpoints · 게이트웨이 {gw?.port}</span>
                </div>
                <div className="adm-row-side">
                  <span className="pill" data-tone={off ? "mute" : "ok"}>
                    {off ? "꺼짐" : "실행 중"}
                  </span>
                  <span>에이전트 {agentCount(s.id)}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="adm-note">
          <b>등급이 높을수록 읽을 수 있는 사람이 적습니다</b>
          <span>
            공개 → 회사 내 → 사업부 내 → 업무 내부 순서입니다. 로컬 LLM을 확인할 수 없어 모든 등급이 LLM API
            Endpoints로 추론합니다.
          </span>
        </div>
      </section>
      <main className="adm-main">
        <div className="detail-bar">
          <span>샌드박스</span>
          <span className="detail-bar-sep">/</span>
          <span className="mono">{sb.name}</span>
          <div className="grow" />
          <button
            type="button"
            className="link-btn"
            data-keep
            onClick={() => {
              const first = adminAgents.find((a) => a.sandbox === sb.id);
              openAdmin("agents", first?.id);
            }}
          >
            <IconLink />
            <span>이 샌드박스의 에이전트 {agentCount(sb.id)}개 보기</span>
          </button>
        </div>
        <div className="adm-body" style={{ gap: 14 }}>
          <div className="adm-hero">
            <div className="adm-hero-face" data-square style={{ background: sb.color.bg, color: sb.color.fg }}>
              {sb.short}
            </div>
            <div>
              <h2 className="mono">{sb.name}</h2>
              <span>
                {sb.gradeLabel} · {sb.taskLabels.length ? `${sb.taskLabels.join(", ")} 태스크` : "연결된 태스크 없음"} ·
                에이전트 명단 {sb.manifest}
              </span>
            </div>
            <span className="pill" data-tone={sb.status === "stopped" ? "mute" : "ok"}>
              {sb.status === "stopped" ? "꺼짐" : "실행 중"}
            </span>
          </div>

          <section className="adm-card" data-tight aria-label="LLM 추론">
            <div className="adm-card-head">
              <h3>LLM 추론</h3>
              <span>제공자와 모델은 바로 적용 · 컨텍스트 길이는 다시 만들 때 적용</span>
            </div>
            <div className="sb-providers" role="radiogroup" aria-label="추론 제공자">
              <button type="button" role="radio" aria-checked="true" className="sb-provider">
                <span>
                  <b>LLM API Endpoints</b>
                </span>
                <span>등록한 API 엔드포인트로 추론합니다. 키는 게이트웨이에 보관됩니다.</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked="false"
                aria-disabled="true"
                disabled
                className="sb-provider"
                title="로컬 LLM을 확인할 수 없어 선택할 수 없습니다"
              >
                <span>
                  <b>Ollama 로컬</b>
                  <em>선택할 수 없음</em>
                </span>
                <span>로컬 LLM을 확인할 수 없습니다.</span>
              </button>
            </div>
            <div className="sb-fields">
              {select("sb-model", "model", opts.models)}
              {select("sb-context", "contextLength", opts.contextLengths)}
              {select("sb-max", "maxTokens", opts.maxTokens)}
            </div>
          </section>

          <section className="adm-card" data-tight aria-label="게이트웨이">
            <div className="adm-card-head">
              <h3>게이트웨이</h3>
              <span>샌드박스를 다시 만들 때 적용</span>
            </div>
            <div className="sb-fields">
              {select(
                "sb-gateway",
                "gateway",
                opts.gateways.map((g) => g.id),
                (v) => opts.gateways.find((g) => g.id === v)?.label ?? String(v),
                false,
              )}
              <div className="sb-field">
                <span>등록된 제공자</span>
                <div className="sb-field-value">
                  <span className="sb-tag">llm-api</span>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>키 등록됨</span>
                </div>
              </div>
              <div className="sb-field">
                <span>제어 화면 포트</span>
                <div className="sb-field-value mono">{sb.controlPort}</div>
              </div>
            </div>
            {dirty.length ? (
              <div className="sb-route" data-tone="warn">
                <IconWarn size={16} style={{ flexShrink: 0 }} />
                <span>
                  지금 추론 경로 <b>llm-api / {sb.model}</b> · 변경 적용 전입니다
                </span>
              </div>
            ) : (
              <div className="sb-route">
                <IconCheck style={{ flexShrink: 0 }} />
                <span>
                  지금 추론 경로 <b>llm-api / {sb.model}</b> · 설정과 같습니다
                </span>
              </div>
            )}
            <div className="sb-shared">
              게이트웨이 하나에는 추론 경로가 하나뿐입니다.{" "}
              {sharing.length ? (
                <>
                  같은 게이트웨이를 쓰는{" "}
                  {sharing.map((s, i) => (
                    <Fragment key={s.id}>
                      <code>{s.name}</code>
                      {i < sharing.length - 1 ? ", " : ""}
                    </Fragment>
                  ))}
                  도 이 경로를 함께 씁니다.
                </>
              ) : (
                <>
                  포트 {gateway?.port} 게이트웨이는 <code>{sb.name}</code>만 씁니다.
                </>
              )}
            </div>
          </section>
        </div>
        <div className="adm-foot">
          <span data-dirty={dirty.length ? true : undefined}>
            {dirty.length ? `바뀐 설정 ${dirty.length}개 · ${dirty.map((k) => FIELD_LABEL[k]).join(", ")}` : "바뀐 설정이 없습니다"}
          </span>
          <button
            type="button"
            className="adm-btn"
            disabled={readOnly || !dirty.length || saving}
            onClick={() => setForm(applied)}
          >
            되돌리기
          </button>
          <button
            type="button"
            className="adm-btn"
            data-primary
            disabled={readOnly || !dirty.length || saving}
            onClick={async () => {
              setSaving(true);
              await updateSandbox(sb.id, form);
              setSaving(false);
            }}
          >
            {saving && <span className="spin" aria-hidden="true" />}
            변경 적용
          </button>
        </div>
      </main>
    </div>
  );
}

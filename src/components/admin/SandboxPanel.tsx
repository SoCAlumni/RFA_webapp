"use client";

import { IconCheck, IconLink, IconPlus } from "@/components/icons";
import { Modal } from "@/components/Modal";
import type { SandboxDetail, SandboxItem, SandboxPatch } from "@/lib/api/types";
import { useApp } from "@/store/app-store";
import { useEffect, useState } from "react";

const STATUS: Record<SandboxItem["status"], { label: string; tone: string }> = {
  running: { label: "실행 중", tone: "ok" },
  stopped: { label: "꺼짐", tone: "mute" },
  unknown: { label: "확인 전", tone: "mute" },
};

/** 목록 타일 글자: 보안 레벨(L2 → 「L2」) */
const tileOf = (s: SandboxItem) => s.securityLabel.split(" ")[0] || s.name.slice(0, 2);
const tileColor = (privilege: number) =>
  privilege >= 2 ? { bg: "#1a1d23", fg: "#fff" } : privilege === 1 ? { bg: "#5a6170", fg: "#fff" } : { bg: "#e6e8ee", fg: "#1a1d23" };

type Form = Required<SandboxPatch>;
const formOf = (d: SandboxDetail): Form => ({
  provider: d.inference.provider,
  model: d.inference.model,
  contextLength: d.inference.contextLength,
  maxOutputTokens: d.inference.maxOutputTokens,
});
const LABEL: Record<keyof Form, string> = {
  provider: "제공자",
  model: "모델",
  contextLength: "컨텍스트 길이",
  maxOutputTokens: "최대 응답 길이",
};

function SandboxDetailView({ id }: { id: string }) {
  const { sandboxDetails, loadSandbox, updateSandbox, openAdmin, data } = useApp();
  const d = sandboxDetails[id];
  const [form, setForm] = useState<Form | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSandbox(id);
  }, [id, loadSandbox]);

  // 불러오거나 적용하면 폼을 서버 값으로 맞춘다
  const [synced, setSynced] = useState<SandboxDetail | null>(null);
  if (d && d !== synced) {
    setSynced(d);
    setForm(formOf(d));
  }

  if (!d || !form)
    return (
      <div className="loading">
        <span className="spin" aria-hidden="true" />
        샌드박스를 불러오는 중
      </div>
    );

  const owner = data?.me.role === "owner";
  const inf = d.inference;
  const applied = formOf(d);
  const changed = (Object.keys(form) as (keyof Form)[]).filter((k) => form[k] !== applied[k]);
  const option = inf.providerOptions.find((o) => o.provider === form.provider);
  const providerChanged = changed.includes("provider") || changed.includes("model");
  const st = STATUS[d.status] ?? STATUS.unknown;

  const apply = async () => {
    // 바뀐 필드만 보낸다(FE_API_GUIDE §5.3)
    const patch: SandboxPatch = {};
    for (const k of changed) Object.assign(patch, { [k]: form[k] });
    setSaving(true);
    await updateSandbox(d.id, patch);
    setSaving(false);
  };

  return (
    <>
      <div className="detail-bar">
        <span>샌드박스</span>
        <span className="detail-bar-sep">/</span>
        <span className="mono">{d.name}</span>
        <div className="grow" />
        <button
          type="button"
          className="link-btn"
          data-keep
          onClick={() =>
            openAdmin("agents", d.agents[0]?.id, { label: `${d.name} 샌드박스의 에이전트`, ids: d.agents.map((a) => a.id) })
          }
        >
          <IconLink />
          <span>이 샌드박스의 에이전트 {d.agentCount}개 보기</span>
        </button>
      </div>
      <div className="adm-body" style={{ gap: 14 }}>
        <div className="adm-hero">
          <div className="adm-hero-face" data-square style={{ background: tileColor(d.privilege).bg, color: tileColor(d.privilege).fg }}>
            {tileOf(d)}
          </div>
          <div>
            <h2 className="mono">
              {d.name}
              {d.default && <span className="sb-default">기본</span>}
            </h2>
            <span>
              {d.securityLabel} · {d.tasks.length ? `${d.tasks.map((t) => t.name).join(", ")} 태스크` : "연결된 태스크 없음"} · 에이전트
              명단 {d.agentsManifest}
            </span>
          </div>
          <span className="pill" data-tone={st.tone} data-unobserved={!d.observed || undefined}>
            {st.label}
          </span>
        </div>

        {d.securityGroups.length > 0 && (
          <section className="adm-card" data-tight aria-label="보안 그룹">
            <div className="adm-card-head">
              <h3>보안 그룹</h3>
              <span>권한 레벨 {d.privilege}</span>
            </div>
            <ul className="sg-list">
              {d.securityGroups.map((g) => (
                <li key={g.id}>
                  <b>{g.id}</b>
                  <em>L{g.privilege}</em>
                  <span>{g.description}</span>
                  {(g.presets.length > 0 || g.mcpServers.length > 0) && (
                    <small>{[...g.presets.map((p) => `preset ${p}`), ...g.mcpServers.map((m) => `MCP ${m}`)].join(" · ")}</small>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="adm-card" data-tight aria-label="LLM 추론">
          <div className="adm-card-head">
            <h3>
              LLM 추론
              {inf.pendingRecreate.length > 0 && (
                <span
                  className="sb-pending"
                  title={`샌드박스에 아직 반영 안 됨: ${inf.pendingRecreate
                    .map((k) => LABEL[k as keyof Form] ?? k)
                    .join(", ")} · 샌드박스가 켜지면 적용`}
                >
                  아직 반영 안 됨
                </span>
              )}
            </h3>
            <span>{d.applyNote}</span>
          </div>
          <div className="sb-providers" role="radiogroup" aria-label="추론 제공자">
            {inf.providerOptions.map((o) => (
              <button
                key={o.provider}
                type="button"
                role="radio"
                aria-checked={form.provider === o.provider}
                aria-disabled={!o.selectable || undefined}
                disabled={!o.selectable || !owner}
                className="sb-provider"
                title={o.selectable ? undefined : (o.reason ?? undefined)}
                onClick={() =>
                  setForm((f) =>
                    f
                      ? {
                          ...f,
                          provider: o.provider,
                          model: o.provider === applied.provider ? applied.model : (o.models[0] ?? ""),
                        }
                      : f,
                  )
                }
              >
                <span>
                  <b>{o.label}</b>
                  {!o.selectable && <em>선택할 수 없음</em>}
                </span>
                <span>{o.selectable ? (o.models.length ? o.models.join(" · ") : "모델을 직접 적습니다") : o.reason}</span>
              </button>
            ))}
          </div>
          <div className="sb-fields">
            <div className="sb-field">
              <label htmlFor="sb-model">모델</label>
              {option?.models.length ? (
                <select
                  id="sb-model"
                  className="mono"
                  value={form.model}
                  disabled={!owner}
                  data-dirty={changed.includes("model") || undefined}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                >
                  {!option.models.includes(form.model) && <option value={form.model}>{form.model}</option>}
                  {option.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="sb-model"
                  className="sb-input mono"
                  value={form.model}
                  disabled={!owner}
                  data-dirty={changed.includes("model") || undefined}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                />
              )}
            </div>
            <div className="sb-field">
              <label htmlFor="sb-context">컨텍스트 길이</label>
              <select
                id="sb-context"
                className="mono"
                value={form.contextLength}
                disabled={!owner}
                data-dirty={changed.includes("contextLength") || undefined}
                onChange={(e) => setForm({ ...form, contextLength: Number(e.target.value) })}
              >
                {inf.contextLengthChoices.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="sb-field">
              <label htmlFor="sb-max">최대 응답 길이</label>
              <select
                id="sb-max"
                className="mono"
                value={form.maxOutputTokens}
                disabled={!owner}
                data-dirty={changed.includes("maxOutputTokens") || undefined}
                onChange={(e) => setForm({ ...form, maxOutputTokens: Number(e.target.value) })}
              >
                {inf.maxOutputChoices.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="adm-card" data-tight aria-label="게이트웨이">
          <div className="adm-card-head">
            <h3>게이트웨이</h3>
            <span>{d.gateway.label}</span>
          </div>
          <div className="sb-fields">
            <div className="sb-field">
              <span>포트</span>
              <div className="sb-field-value mono">{d.gateway.port ?? "없음"}</div>
            </div>
            <div className="sb-field">
              <span>등록된 제공자</span>
              <div className="sb-field-value">
                <span className="sb-tag">{d.gateway.registeredProvider}</span>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{d.gateway.hasKey ? "키 등록됨" : "키 없음"}</span>
              </div>
            </div>
            <div className="sb-field">
              <span>샌드박스 쪽 경로</span>
              <div className="sb-field-value mono">
                {[d.gateway.sandboxProvider, d.gateway.sandboxModel].filter(Boolean).join(" / ") || "—"}
              </div>
            </div>
          </div>
          <div className="sb-route" data-tone={changed.length ? "warn" : undefined}>
            <IconCheck style={{ flexShrink: 0 }} />
            <span>
              지금 추론 경로 <b>{d.gateway.currentRoute}</b>
              {changed.length ? " · 변경 적용 전입니다" : ""}
            </span>
          </div>
          {d.gateway.sharedWith.length > 0 && (
            <div className="sb-shared">
              프록시가 하나라 제공자 · 모델을 바꾸면{" "}
              {d.gateway.sharedWith.map((s, i) => (
                <span key={s}>
                  <code>{s}</code>
                  {i < d.gateway.sharedWith.length - 1 ? ", " : ""}
                </span>
              ))}
              에도 한꺼번에 적용됩니다.
            </div>
          )}
        </section>
      </div>
      <div className="adm-foot">
        <span data-dirty={changed.length ? true : undefined}>
          {changed.length ? `바뀐 설정 ${changed.length}개 · ${changed.map((k) => LABEL[k]).join(", ")}` : "바뀐 설정이 없습니다"}
        </span>
        <button type="button" className="adm-btn" disabled={!owner || !changed.length || saving} onClick={() => setForm(applied)}>
          되돌리기
        </button>
        <button
          type="button"
          className="adm-btn"
          data-primary
          disabled={!owner || !changed.length || saving || !form.model.trim()}
          onClick={() => (providerChanged ? setConfirm(true) : apply())}
        >
          {saving && <span className="spin" aria-hidden="true" />}
          {saving ? "적용하는 중" : "변경 적용"}
        </button>
      </div>
      {confirm && (
        <Modal label="변경 적용" className="rfa-dialog rfa-dialog-sm" onClose={() => setConfirm(false)}>
          <h2>모든 샌드박스에 적용할까요?</h2>
          <p>
            제공자와 모델은 프록시가 하나라 모든 샌드박스에 한꺼번에 적용됩니다
            {d.gateway.sharedWith.length ? ` (${[d.name, ...d.gateway.sharedWith].join(", ")})` : ""}. 컨텍스트 길이 · 최대
            응답 길이는 이 샌드박스에만 바로 적용됩니다.
          </p>
          <div className="rfa-actions">
            <button type="button" className="rfa-btn" data-autofocus onClick={() => setConfirm(false)}>
              취소
            </button>
            <button
              type="button"
              className="rfa-btn rfa-btn-primary"
              onClick={() => {
                setConfirm(false);
                apply();
              }}
            >
              적용
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function SandboxPanel() {
  const { admin, sandboxList, selectSandbox, setDialog, api, fail, notify } = useApp();
  if (!sandboxList)
    return (
      <div className="loading">
        <span className="spin" aria-hidden="true" />
        샌드박스를 불러오는 중
      </div>
    );
  const list = sandboxList.sandboxes;
  const sel = list.find((s) => s.id === admin.sandboxId) ?? list.find((s) => s.default) ?? list[0];

  return (
    <div className="adm-grid">
      <section className="adm-list" aria-label="샌드박스 목록">
        <div className="adm-list-head">
          <div>
            <h1>샌드박스</h1>
            <span>
              {list.length} / {sandboxList.limit}개 · 보안 레벨마다 하나씩 둡니다
            </span>
          </div>
          <button
            type="button"
            className="adm-add"
            data-keep
            // 한도가 차면 POST 없이 안내만 보여 준다(FE_API_GUIDE §5.1). 열려 있으면 서버에 요청한다
            onClick={() =>
              sandboxList.canAdd
                ? api.addSandbox().then(() => notify("샌드박스를 추가했습니다"), fail)
                : setDialog("sandboxLimit")
            }
          >
            <IconPlus size={14} />
            <span>추가</span>
          </button>
        </div>
        <div>
          {list.map((s) => {
            const st = STATUS[s.status] ?? STATUS.unknown;
            const tc = tileColor(s.privilege);
            return (
              <button
                key={s.id}
                type="button"
                data-keep
                className="adm-row"
                aria-current={s.id === sel?.id}
                onClick={() => selectSandbox(s.id)}
              >
                <div className="sq-face" style={{ background: tc.bg, color: tc.fg, marginTop: 2 }}>
                  {tileOf(s)}
                </div>
                <div className="adm-row-text">
                  <b className="mono">
                    {s.name}
                    {s.default && <span className="sb-default">기본</span>}
                  </b>
                  <span data-dim={!s.tasks.length || undefined}>
                    {s.tasks.length ? s.tasks.map((t) => t.name).join(", ") : "연결된 태스크 없음"}
                  </span>
                  <span>
                    {s.securityLabel} · {s.provider}
                    {s.gatewayPort ? ` · 게이트웨이 ${s.gatewayPort}` : ""}
                  </span>
                </div>
                <div className="adm-row-side">
                  <span className="pill" data-tone={st.tone} data-unobserved={!s.observed || undefined}>
                    {st.label}
                  </span>
                  <span>에이전트 {s.agentCount}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="adm-note">
          <b>레벨이 높을수록 할 수 있는 일이 많습니다</b>
          <span>샌드박스마다 보안 그룹(권한 레벨)이 다르고, 에이전트는 자기 샌드박스의 권한 안에서만 움직입니다.</span>
        </div>
      </section>
      <main className="adm-main">{sel ? <SandboxDetailView key={sel.id} id={sel.id} /> : null}</main>
    </div>
  );
}

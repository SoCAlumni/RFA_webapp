"use client";

import type { DraftPhase, InboxDetail, Step } from "@/lib/api/types";
import { dayTime, seconds } from "@/lib/format";
import { useApp } from "@/store/app-store";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const Check = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);
const Chevron = () => (
  <svg className="dc-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const Regen = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 11a8 8 0 0 0-14.9-3.9L4 9" />
    <path d="M4 4v5h5" />
    <path d="M4 13a8 8 0 0 0 14.9 3.9L20 15" />
    <path d="M20 20v-5h-5" />
  </svg>
);
const Send = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 4l17 8-17 8 3-8-3-8z" />
  </svg>
);

function StepRow({ step, index, open, onToggle }: { step: Step; index: number; open: boolean; onToggle: () => void }) {
  const idle = step.state === "pending" || step.state === "skipped";
  const running = step.state === "running";
  return (
    <li className="dc-step" data-state={step.state}>
      <button
        type="button"
        className="dc-step-row"
        onClick={onToggle}
        disabled={idle || !step.details.length}
        aria-expanded={idle ? undefined : open}
      >
        <span className="dc-step-mark" aria-hidden="true">
          {step.state === "done" ? <Check /> : running ? <span className="dc-spin" /> : step.state === "error" ? "!" : index + 1}
        </span>
        <b>{step.title}</b>
        <span className="dc-step-sum">
          {step.state === "pending" ? "대기" : step.state === "skipped" ? "건너뜀" : step.summary}
        </span>
        <span className="dc-step-ms">{step.state === "done" ? seconds(step.ms) : ""}</span>
        {!idle && step.details.length > 0 ? <Chevron /> : <span />}
      </button>
      {open && !idle && (
        <ul className="dc-details">
          {step.details.map((d, i) => (
            <li key={i} data-tone={d.tone}>
              <span>{d.label}</span>
              {d.meta && <em>{d.meta}</em>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const WHO: Record<string, string> = { desk: "대응 에이전트", human: "사람", publisher: "게시", system: "시스템" };
const WHAT: Record<string, string> = {
  pending: "결재 요청",
  approved: "승인",
  rejected: "재생성 요청",
  posted: "게시됨",
  closed: "닫힘",
};

/** 결재 기록(events)과 이전 초안(regenerations) */
function History({ detail }: { detail: InboxDetail }) {
  const { events } = detail;
  const regens = detail.draft.regenerations;
  if (!events.length && !regens.length) return null;
  return (
    <details className="dc-history">
      <summary>
        기록 · {events.length}건{regens.length ? ` · 이전 초안 ${regens.length}개` : ""}
      </summary>
      {events.length > 0 && (
        <ol className="dc-timeline">
          {events.map((e, i) => (
            <li key={i}>
              <time>{dayTime(e.at)}</time>
              <b>{WHAT[e.what ?? ""] ?? e.what}</b>
              <span>
                {WHO[e.who ?? ""] ?? e.who}
                {e.detail ? ` · ${e.detail === "edited" ? "고친 초안으로" : e.detail}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
      {regens.map((r, i) => (
        <div key={i} className="dc-old">
          <div>
            <b>{i + 1}번째 초안</b>
            <span>
              {dayTime(r.at)}
              {r.request ? ` · 요청 「${r.request}」` : ""}
            </span>
          </div>
          {r.draft && <p>{r.draft}</p>}
        </div>
      ))}
    </details>
  );
}

const QUICK = ["더 짧게", "더 정중하게", "수치 언급은 빼고", "다음 안내 시점을 덧붙여서"];

function RegenModal({
  onCancel,
  onSubmit,
  left,
  closes,
}: {
  onCancel: () => void;
  onSubmit: (text: string) => void;
  left: number;
  closes: boolean;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);
  const submit = () => {
    if (text.trim()) onSubmit(text.trim());
  };
  return createPortal(
    <div
      className="dc-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="dc-modal" role="dialog" aria-modal="true" aria-labelledby="dc-regen-title">
        <h2 id="dc-regen-title">재생성 요청</h2>
        <p>초안을 어떻게 바꿀지 적어 주세요. 적은 내용이 피드백으로 함께 전달되어 새 초안을 만듭니다.</p>
        {closes ? (
          <p className="dc-warn">이번이 마지막 재생성 요청입니다. 보내면 결재가 닫히고 응답하지 않기로 합니다.</p>
        ) : (
          <p className="dc-hint">재생성은 {left}번 더 요청할 수 있어요.</p>
        )}
        <label className="dc-field">
          <span>요청 내용</span>
          <textarea
            ref={ref}
            rows={4}
            value={text}
            maxLength={400}
            placeholder="예: 수치 언급 없이 더 짧게, 다음 안내 시점을 함께 적어 줘"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <div className="dc-quick" aria-label="자주 쓰는 요청">
          {QUICK.map((q) => (
            <button key={q} type="button" onClick={() => setText((t) => (t.trim() ? `${t.trim()}, ${q}` : q).slice(0, 400))}>
              {q}
            </button>
          ))}
        </div>
        <div className="dc-modal-actions">
          <button type="button" className="dc-btn" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="dc-btn dc-btn-primary" onClick={submit} disabled={!text.trim()}>
            <Regen />
            {closes ? "보내고 닫기" : "재생성 요청"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const PHASE: Record<DraftPhase, { status: string; title: string; tone: string }> = {
  drafting: { status: "작성 중", title: "대응 에이전트가 답변 초안을 쓰고 있습니다", tone: "running" },
  stalled: { status: "초안 없음", title: "대응 에이전트가 초안을 올리지 않았습니다", tone: "muted" },
  ready: { status: "승인 대기", title: "이 초안으로 응답할까요?", tone: "ready" },
  regenerating: { status: "재생성 중", title: "새 초안을 기다리는 중입니다", tone: "regenerating" },
  posting: { status: "보내는 중", title: "승인했습니다. 게시하는 중입니다", tone: "posting" },
  publish_failed: { status: "게시 실패", title: "게시하지 못했습니다", tone: "failed" },
  posted: { status: "응답함", title: "이 답변으로 응답했습니다", tone: "posted" },
  closed: { status: "닫힘", title: "응답하지 않기로 했습니다", tone: "muted" },
};

/** 결재 서버가 RFA_PUBLISHER=mock 이면 채널을 부르지 않고 mock:// 주소만 남긴다 */
export const isMockPosted = (d: InboxDetail) =>
  d.draft.phase === "posted" && !!d.draft.postedUrl?.startsWith("mock://");

const MOCK_POSTED = { status: "모의 게시", title: "승인했지만 채널에는 올리지 않았습니다", tone: "muted" };

/** 결재 초안 카드: 뒷단 단계 · 편집 · 재생성 요청 · 바로 응답 */
export function DraftCard({ detail, readOnly }: { detail: InboxDetail; readOnly?: boolean }) {
  const { edits, setDraftText, regenerate, respond, busyItems, itemErrors } = useApp();
  const draft = detail.draft;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [asking, setAsking] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const regenBtn = useRef<HTMLButtonElement>(null);
  const busy = busyItems[detail.id];
  const text = edits[detail.id] ?? draft.text;
  const phase = busy === "respond" ? "posting" : busy === "regenerate" ? "regenerating" : draft.phase;
  const mockPosted = isMockPosted(detail);
  const p = mockPosted ? MOCK_POSTED : (PHASE[phase] ?? PHASE.ready);
  const editable = !readOnly && !busy && draft.phase === "ready" && draft.canRespond;

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 320)}px`;
  }, [text]);

  const edited = text.trim() !== draft.text.trim();
  const where = detail.source.kind === "github" ? "이 이슈에 댓글로" : "이 스레드로";
  const who = detail.agent?.desk ?? detail.task?.name ?? "대응";
  const hasText = !!draft.text || phase === "ready";
  const retry = draft.phase === "publish_failed";

  return (
    <section
      className="dc-card"
      aria-label={detail.approvalId != null ? `결재 ${detail.approvalId} 답변 초안` : "답변 초안"}
      aria-busy={phase === "regenerating" || phase === "drafting"}
    >
      <header className="dc-head">
        <div>
          <span className="dc-kicker">
            {detail.approvalId != null ? `결재 ${detail.approvalId} · ` : ""}
            {who} 에이전트
            {draft.phase === "drafting" || draft.phase === "stalled" ? "에게 요청이 들어왔습니다" : "가 답변 초안을 올렸습니다"}
          </span>
          <h3>{p.title}</h3>
        </div>
        <span className="dc-grade" data-grade={detail.gradeLabel} title="결재 대상 등급">
          {detail.gradeLabel}
        </span>
        <span className="dc-status" data-phase={p.tone}>
          {(phase === "regenerating" || phase === "posting" || phase === "drafting") && <span className="dc-spin" />}
          {p.status}
        </span>
      </header>
      <div className="dc-pipeline">
        <div className="dc-pipeline-head">
          <span>뒷단에서 진행한 단계{detail.stepsRecorded ? "" : " · 기록된 단계만"}</span>
          {draft.round > 1 && <span className="dc-round">재생성 {draft.round - 1}회</span>}
        </div>
        <ol>
          {detail.steps.map((s, i) => (
            <StepRow
              key={s.key}
              step={s}
              index={i}
              open={!!open[s.key]}
              onToggle={() => setOpen((o) => ({ ...o, [s.key]: !o[s.key] }))}
            />
          ))}
        </ol>
        {detail.blockedAttempts.length > 0 && (
          <ul className="dc-details dc-blocked">
            {detail.blockedAttempts.map((b, i) => (
              <li key={i} data-tone="block">
                <span>{b.action}</span>
                <em>{b.reason}</em>
              </li>
            ))}
          </ul>
        )}
        {draft.lastRequest && (
          <p className="dc-request">
            <b>재생성 요청</b>
            <span>{draft.lastRequest}</span>
          </p>
        )}
      </div>
      {detail.refusal && <p className="dc-note">담당 에이전트: {detail.refusal}</p>}
      {hasText && (
        <div className="dc-draft">
          <div className="dc-draft-head">
            <label htmlFor={`dc-text-${detail.id}`}>
              답변 초안{" "}
              <span>
                {phase === "posted"
                  ? mockPosted
                    ? "모의 게시 · 보내지 않았습니다"
                    : `${where} 보냈습니다`
                  : phase === "regenerating"
                    ? "새 초안을 기다리는 중"
                    : readOnly
                      ? "게스트는 볼 수만 있어요"
                      : editable
                        ? "바로 고쳐 쓸 수 있어요"
                        : ""}
              </span>
            </label>
            <span className="dc-count">
              {edited && editable && (
                <button type="button" className="dc-revert" onClick={() => setDraftText(detail.id, draft.text)}>
                  되돌리기
                </button>
              )}
              {edited && phase !== "posted" && <b>수정함 · </b>}
              {text.length}자 · {detail.gradeLabel}로 나감
            </span>
          </div>
          <textarea
            id={`dc-text-${detail.id}`}
            ref={textRef}
            value={text}
            onChange={(e) => setDraftText(detail.id, e.target.value)}
            readOnly={!editable}
            data-waiting={phase === "regenerating" || undefined}
            rows={5}
            spellCheck={false}
          />
        </div>
      )}
      {draft.publishError && <p className="dc-note dc-note-error">게시 실패: {draft.publishError}</p>}
      {itemErrors[detail.id] && (
        <p className="dc-note dc-note-error" role="alert">
          {itemErrors[detail.id]}
        </p>
      )}
      {mockPosted ? (
        // 결재 서버가 RFA_PUBLISHER=mock 이면 채널을 부르지 않고 mock:// 주소만 남긴다
        <p className="dc-note">
          모의 게시로 처리했습니다 · 결재 서버가 모의 게시 모드라 GitHub · Slack 에는 올리지 않았습니다
        </p>
      ) : phase === "posted" ? (
        <p className="dc-posted">
          <Check /> 응답했습니다 ·{" "}
          {draft.postedUrl?.startsWith("http") ? (
            <a href={draft.postedUrl} target="_blank" rel="noopener noreferrer">
              <span>{draft.postedUrl}</span>
            </a>
          ) : (
            <span>{draft.postedUrl}</span>
          )}
        </p>
      ) : phase === "closed" || phase === "stalled" ? null : (
        <div className="dc-actions">
          {draft.canRegenerate && (
            <button
              type="button"
              className="dc-btn"
              ref={regenBtn}
              onClick={() => setAsking(true)}
              disabled={readOnly || !!busy || phase !== "ready"}
              title={`재생성 ${draft.regenerationsLeft}번 남음`}
            >
              <Regen />
              재생성 요청
            </button>
          )}
          <button
            type="button"
            className="dc-btn dc-btn-primary"
            onClick={() => respond(detail.id)}
            disabled={readOnly || !!busy || !draft.canRespond || !text.trim()}
          >
            {phase === "posting" ? <span className="dc-spin dc-spin-light" /> : <Send />}
            {retry ? "다시 게시" : "바로 응답"}
          </button>
        </div>
      )}
      <History detail={detail} />
      {asking && (
        <RegenModal
          left={draft.regenerationsLeft}
          closes={draft.closesOnRegenerate}
          onCancel={() => {
            setAsking(false);
            regenBtn.current?.focus();
          }}
          onSubmit={(req) => {
            setAsking(false);
            regenerate(detail.id, req);
          }}
        />
      )}
    </section>
  );
}
